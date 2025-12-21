"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import {
  createStripeCheckoutSession,
  retrieveStripeCheckoutSession,
} from "@/lib/stripe"
import { headers } from "next/headers"

function getOrigin() {
  const headerList = headers()
  const origin = headerList.get("origin")
  if (origin) return origin

  const proto = headerList.get("x-forwarded-proto") || "http"
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "localhost:3000"
  return `${proto}://${host}`
}

export async function createCheckoutSession(productId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: "You must be logged in to start checkout." }
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return { error: "Plan could not be found." }
    }

    const invoice = await prisma.invoice.create({
      data: {
        userId: session.user.id,
        amount: product.price,
        status: "UNPAID",
        dueDate: new Date(),
        items: {
          productId: product.id,
          name: product.name,
          billingCycle: product.billingCycle,
          price: product.price,
        },
      },
    })

    const origin = getOrigin()

    let stripeSession

    try {
      stripeSession = await createStripeCheckoutSession({
        productName: product.name,
        description: product.description,
        amountCents: Math.round(product.price * 100),
        currency: "usd",
        customerEmail: session.user.email,
        successUrl: `${origin}/dashboard/billing/checkout?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/dashboard/store?cancelled=1`,
        metadata: {
          invoiceId: invoice.id,
          userId: session.user.id,
          productId: product.id,
        },
        uiMode: "embedded",
      })
    } catch (err) {
      await prisma.invoice.delete({ where: { id: invoice.id } })
      throw err
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        items: {
          productId: product.id,
          name: product.name,
          billingCycle: product.billingCycle,
          price: product.price,
          stripeSessionId: stripeSession.id,
        },
      },
    })

    return { sessionId: stripeSession.id, invoiceId: invoice.id, clientSecret: stripeSession.client_secret }
  } catch (error: any) {
    console.error("Failed to create checkout session", error)
    return { error: "Unable to start checkout. Please try again." }
  }
}

export async function getCheckoutSession(sessionId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: "Unauthorized" }
  }

  try {
    const checkout = await retrieveStripeCheckoutSession(sessionId)

    if (checkout.metadata?.userId && checkout.metadata.userId !== session.user.id) {
      return { error: "This checkout session does not belong to your account." }
    }

    return {
      sessionId: checkout.id,
      clientSecret: checkout.client_secret,
      status: checkout.status,
      paymentStatus: checkout.payment_status,
      invoiceId: checkout.metadata?.invoiceId,
    }
  } catch (error) {
    console.error("Failed to fetch checkout session", error)
    return { error: "Unable to load checkout session." }
  }
}

export async function finalizeCheckout(sessionId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: "Unauthorized" }
  }

  if (!sessionId) {
    return { error: "Missing Stripe session ID." }
  }

  try {
    const stripeSession = await retrieveStripeCheckoutSession(sessionId)
    if (!stripeSession?.metadata?.invoiceId) {
      return { error: "Stripe session is missing invoice metadata." }
    }

    if (stripeSession.metadata.userId && stripeSession.metadata.userId !== session.user.id) {
      return { error: "This payment session does not belong to your account." }
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: stripeSession.metadata.invoiceId },
    })

    if (!invoice) {
      return { error: "Invoice not found." }
    }

    const items =
      typeof invoice.items === "object" && invoice.items !== null
        ? invoice.items as Record<string, any>
        : {}

    const isPaid = stripeSession.payment_status === "paid" || stripeSession.status === "complete"

    let updatedInvoice = invoice

    if (isPaid && invoice.status !== "PAID") {
      const [inv] = await prisma.$transaction([
        prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: "PAID",
            paidAt: invoice.paidAt ?? new Date(),
            items: {
              ...items,
              stripeSessionId: sessionId,
              stripePaymentIntent: stripeSession.payment_intent,
              stripeStatus: stripeSession.payment_status,
            },
          },
        }),
        prisma.user.update({
          where: { id: invoice.userId },
          data: { balance: { increment: invoice.amount } },
        }),
      ])
      updatedInvoice = inv
    } else if (!isPaid && invoice.status !== "UNPAID") {
      updatedInvoice = await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "UNPAID",
          items: {
            ...items,
            stripeSessionId: sessionId,
            stripeStatus: stripeSession.payment_status,
          },
        },
      })
    }

    return {
      invoice: updatedInvoice,
      stripeStatus: stripeSession.payment_status,
    }
  } catch (error: any) {
    console.error("Failed to finalize checkout", error)
    return { error: "Unable to verify payment. Please contact support." }
  }
}
