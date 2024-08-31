output "bucket-url" {
  value = digitalocean_spaces_bucket.static-assets.bucket_domain_name
}