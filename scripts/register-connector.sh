#!/bin/sh

echo "Waiting for Debezium Connect to be available..."
until curl -s -f -o /dev/null http://debezium:8083/connectors; do
  echo "Debezium REST API not ready yet. Retrying in 3 seconds..."
  sleep 3
done

echo "Debezium is ready! Checking if connector already exists..."
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://debezium:8083/connectors/ecommerce-outbox-connector)

if [ "$STATUS_CODE" -eq 200 ]; then
  echo "Connector 'ecommerce-outbox-connector' is already registered."
else
  echo "Registering 'ecommerce-outbox-connector'..."
  curl -s -X POST -H "Accept:application/json" -H "Content-Type:application/json" \
    http://debezium:8083/connectors/ \
    -d @/scripts/debezium-postgres-connector.json
  echo "\nConnector registered successfully!"
fi
