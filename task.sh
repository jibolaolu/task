#!/bin/bash

set -e
ARG=$1

image_tag="task:latest"
if [ "$ARG" = "build" ]
then
     docker build --rm -f "Dockerfile" -t ${image_tag} .
     docker rm -f $( docker ps -q  | grep ${image_tag}  | awk  '{print $1}') 2>/dev/null  || true
    sleep 3
     docker run -p 3000:80 -it ${image_tag}

elif [ "$ARG" = "destroy" ]
then
     docker rm -f $( docker ps -q  | grep ${image_tag}  | awk  '{print $1}') 2>/dev/null  || true
     docker rmi -f ${image_tag} 2>/dev/null  || true

else
   echo  -ne "Usage ./$0 build\n"
   exit 1
fi
