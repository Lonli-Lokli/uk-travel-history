# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Subscription Lifecycle Handling** (#128)
  - Added `paused` status to subscription lifecycle
  - Added `cancel_at_period_end` tracking for scheduled cancellations
  - Added `pause_resumes_at` tracking for paused subscriptions
  - Added UNIQUE constraints on Stripe IDs to prevent duplicates
  - Updated grace period logic for scheduled cancellations
  - Fixed RLS policies to protect new entitlement columns
  - Added type safety for `pauseCollection` parameter
  - Added comprehensive tests for paused subscriptions and grace periods
  - Added subscription state logging helper function

### Documentation
- Added comprehensive Stripe webhook configuration guide (`docs/STRIPE_WEBHOOK_SETUP.md`)
- Added detailed subscription lifecycle documentation in webhook handler

## [0.1.0] - Initial Release

### Added
- UK travel history tracking
- Vignette entry date and visa start date tracking
- Continuous leave calculation per Home Office guidance
- Rolling 12-month absence check (180-day limit)
- PDF parsing from Home Office SAR documents
- Excel export with complete visa/vignette information
- Clerk authentication integration
- Stripe subscription management
- Supabase database with RLS policies
