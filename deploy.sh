gcloud builds submit \
  --tag gcr.io/$GOOGLE_CLOUD_PROJECT/gcp-saldos-subscriber:1.0.0 \

gcloud run deploy gcp-saldos-subscriber \
  --image gcr.io/$GOOGLE_CLOUD_PROJECT/gcp-saldos-subscriber:1.0.0 \
  --platform managed \
  --region "us-central" \
  --no-allow-unauthenticated \
  --max-instances=1