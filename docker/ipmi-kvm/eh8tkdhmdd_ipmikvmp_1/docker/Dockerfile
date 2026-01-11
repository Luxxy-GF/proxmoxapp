FROM jlesage/baseimage-gui:ubuntu-20.04

ENV APP_NAME="KVM Proxy" HOME="/app"
ENV USER_ID="33"
ENV GROUP_ID="33"
ENV DISPLAY_WIDTH="1440"
ENV DISPLAY_HEIGHT="900"

COPY keycode-hack.c /keycode-hack.c

RUN apt-get update && \
    apt-get install -y wget gcc software-properties-common libx11-dev && \
    apt-get install -y strace vim && \
    apt-get update && \
    apt-get autoremove -y && \
    apt-get update && \
    apt-get install apt-utils -y && \
    apt install icedtea-netx -y && \
    apt install default-jdk -y && \
    apt install openjdk-8-jdk -y && \
    apt install openjdk-13-jdk -y && \
    apt install openjdk-16-jdk -y && \
    apt install openjdk-17-jdk -y
    
RUN wget http://mirror.tenantos.com/javaVersions/jdk-8u121-linux-x64.tar.gz -O /tmp/jdk-8u121-linux-x64.tar.gz && \
    mkdir -p /usr/lib/jvm/java8u121 && \
    tar -xf /tmp/jdk-8u121-linux-x64.tar.gz --strip-components 1 -C /usr/lib/jvm/java8u121/ && \
    rm -rf /usr/lib/jvm/java8u121/jre/lib/security/java.security && \
    gcc -o /keycode-hack.so /keycode-hack.c -shared -s -ldl -fPIC
    
RUN apt update && \
    apt install lsof -y
    
RUN apt update && \
    apt install unzip -y && \
    apt-get install -y libgbm-dev && \
    apt-get install -y libxkbcommon-x11-0 && \
    apt-get install -y libgtk-3-0
    
RUN mkdir -p /usr/tenantos/browsers
    
RUN wget http://mirror.tenantos.com/dockerBins/browsers/chromium-128.0.6607.0.zip -O /tmp/chromium-128.0.6607.0.zip && \
    mkdir /usr/tenantos/browsers/chromium-128.0.6607.0 && \
    unzip /tmp/chromium-128.0.6607.0.zip -d /usr/tenantos/browsers/chromium-128.0.6607.0
    
RUN wget http://mirror.tenantos.com/dockerBins/browsers/chromium-83.0.4103.116.zip -O /tmp/chromium-83.0.4103.116.zip && \
    mkdir /usr/tenantos/browsers/chromium-83.0.4103.116 && \
    unzip /tmp/chromium-83.0.4103.116.zip -d /usr/tenantos/browsers/chromium-83.0.4103.116
    
RUN chown -R 33:33 /usr/tenantos/browsers

RUN apt update && \
    apt install xdg-utils -y
    
RUN apt update && \
    apt install yad -y
    
RUN apt update && \
    apt install libxss1 -y

RUN wget http://mirror.tenantos.com/dockerBins/xtigervncviewer1.13.deb -O /tmp/xtigervncviewer1.13.deb && \
    apt update && \
    apt install /tmp/xtigervncviewer1.13.deb -y && \
    rm -rf /tmp/xtigervncviewer1.13.deb

RUN rm -rf /etc/ssl/openssl.cnf

RUN wget http://mirror.tenantos.com/dockerBins/openssl.cnf -O /etc/ssl/openssl.cnf

RUN mkdir -p /etc/chromium/policies/managed/
RUN echo '{ \
    "DownloadDirectory": "/tmp/downloads/new/", \
    "DownloadRestrictions": 0, \
    "ExemptDomainFileTypePairsFromFileTypeDownloadWarnings": [{ \
      "domains": ["*"], \
      "file_extension": "jnlp" \
    }], \
    "SafeBrowsingProtectionLevel": 0 \
}' > /etc/chromium/policies/managed/policies.json

RUN apt update && \
    apt install libfaketime faketime -y
    
RUN apt update && \
    apt install python3 python3-pip -y && \
    yes | pip install -U selenium

RUN rm -rf /var/www/
RUN mkdir /usr/tenantos/scripts
RUN mkdir /workdir
RUN chown 33:33 /workdir

RUN mkdir -p /var/www/ISOs
RUN chown -R 33:33 /var/www


RUN wget http://mirror.tenantos.com/dockerBins/browsers/selenium-v1.zip -O /tmp/selenium-v1.zip && \
    unzip /tmp/selenium-v1.zip -d /usr/tenantos
RUN chown -R 33:33 /usr/tenantos/selenium

RUN apt update && \
    apt install xdotool -y
    
RUN apt update && \
    apt install wmctrl -y
    
RUN wget http://mirror.tenantos.com/dockerBins/meshcentral/meshcentral-v1.1.43.zip -O /tmp/meshcentral-v1.1.43.zip && \
    unzip /tmp/meshcentral-v1.1.43.zip -d /usr/tenantos
RUN chown -R 33:33 /usr/tenantos/meshcentral

RUN mkdir /usr/tenantos/nodejs
RUN wget http://mirror.tenantos.com/dockerBins/nodejs/node-v22.14.0-linux-x64.tar.xz -O /tmp/node-v22.14.0-linux-x64.tar.xz && \
    tar -xf /tmp/node-v22.14.0-linux-x64.tar.xz -C /usr/tenantos/nodejs
RUN chown -R 33:33 /usr/tenantos/nodejs



RUN apt-get remove -y gcc && \
    rm -rf /var/lib/apt/lists/* && \
    rm /keycode-hack.c

COPY startapp.sh /startapp.sh
COPY downloadWatcher.sh /usr/tenantos/scripts/downloadWatcher.sh
COPY startJnlp.sh /usr/tenantos/scripts/startJnlp.sh
COPY java-11.security /etc/java-11-openjdk/security/java.security
COPY java-8.security /etc/java-8-openjdk/security/java.security
COPY java-8.security /usr/lib/jvm/java8u121/jre/lib/security/java.security

RUN chown -R 33:33 /usr/tenantos/scripts

RUN sed -i 's/<decor>no/<decor>yes/' /etc/X11/openbox/rc.xml
RUN sed -i 's/<maximized>true/<maximized>false/' /etc/X11/openbox/rc.xml

WORKDIR /workdir