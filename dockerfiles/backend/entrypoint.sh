#!/bin/sh

# READ the Password
if [ -f "$MYSQL_PASSWORD_FILE" ]; then
    export MYSQL_PASSWORD=$(cat $MYSQL_PASSWORD_FILE)
fi


cd /app
pm2-runtime start server.js --name backend

# Keep container running even with error
tail -f /dev/null
