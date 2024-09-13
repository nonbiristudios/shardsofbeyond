terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.40.0"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
  spaces_access_id = var.spaces_access_id
  spaces_secret_key = var.spaces_secret_key
}

resource "digitalocean_project" "shardsofbeyond" {
  name        = "shardsofbeyond"
  description = "Shards of Beyond Infrastructure"
  purpose     = "Web Application"
  environment = "Development"
  is_default  = "true"
}

resource "digitalocean_spaces_bucket" "assets" {
  name   = var.bucket_name
  region = var.bucket_region
  acl    = "public-read"
  force_destroy = true
}

resource "digitalocean_project_resources" "resources" {
  project = digitalocean_project.shardsofbeyond.id
  resources = [
    digitalocean_spaces_bucket.assets.urn
  ]
}

resource "digitalocean_cdn" "assets-cdn" {
  origin = digitalocean_spaces_bucket.assets.bucket_domain_name
}

resource "digitalocean_spaces_bucket_cors_configuration" "assets-cors" {
  bucket = digitalocean_spaces_bucket.assets.id
  region = digitalocean_spaces_bucket.assets.region

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
    max_age_seconds = 31536000
  }
}