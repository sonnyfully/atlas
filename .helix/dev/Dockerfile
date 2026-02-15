# Generated Dockerfile for Helix instance: dev
FROM lukemathwalker/cargo-chef:latest-rust-1.88 AS chef
WORKDIR /build

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the cached repo workspace first (contains all dependencies and Cargo.toml files)
COPY helix-repo-copy/ ./

# Then overlay instance-specific files
COPY helix-container/ ./helix-container/

FROM chef AS planner
# Generate the recipe file for dependency caching
RUN cargo chef prepare --recipe-path recipe.json --bin helix-container

FROM chef AS builder
# Copy the recipe file
COPY --from=planner /build/recipe.json recipe.json

# Build dependencies - this is the caching Docker layer!
RUN cargo chef cook --features dev --recipe-path recipe.json --bin helix-container

# Copy source code and build the application
COPY helix-repo-copy/ ./
COPY helix-container/ ./helix-container/
RUN cargo build --features dev --package helix-container

# Runtime image
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy the built binary
COPY --from=builder /build/target/debug/helix-container /usr/local/bin/helix-container

# Create data directory
RUN mkdir -p /data

# Expose port (will be overridden by docker-compose)
EXPOSE 6969

# Run the application
CMD ["helix-container"]
