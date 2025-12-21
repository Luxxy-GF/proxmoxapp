export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return new NextResponse("Missing fields", { status: 400 })
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email }
    })

    if (existing) {
      return new NextResponse("User already exists", { status: 409 })
    }

    // First user becomes ADMIN
    const count = await prisma.user.count()
    const role = count === 0 ? "ADMIN" : "USER"

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: email.split("@")[0],
        role,
        balance: 0.0
      }
    })

    return NextResponse.json({
      success: true,
      userId: user.id,
      role: user.role
    })
  } catch (error) {
    console.error("Registration Error:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
