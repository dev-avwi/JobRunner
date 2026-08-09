#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Schema changes are applied deliberately (drizzle-kit), not on every merge:
# the DB already holds live data and automatic push/migrate can prompt or destructively truncate.
