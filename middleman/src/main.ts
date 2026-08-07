#!/usr/bin/env node
import { startupLine } from './startup.js';

process.stdout.write(`${startupLine()}\n`);
