variable "do_token" {
  type = string
  sensitive = true
}

variable "bucket_name" {
  type = string
}

variable "bucket_region" {
  type = string
}

variable "spaces_access_id" {
  type = string
  sensitive = true
}

variable "spaces_secret_key" {
  type = string
  sensitive = true
}