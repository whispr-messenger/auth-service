#!/bin/bash

npm ci --legacy-peer-deps

npm run test:e2e
