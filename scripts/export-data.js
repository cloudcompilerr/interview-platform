#!/usr/bin/env node
/**
 * export-data.js
 *
 * Convenience utility for working with Interview Platform backup files
 * (the JSON exported from the app's Data & Reports screen, or via
 * localStorage.getItem('ip_interviews_v1') / 'ip_domains_v1' in DevTools).
 *
 * The app itself runs entirely in the browser and never needs Node — this
 * script is just a optional helper for converting a downloaded backup into
 * other formats from the command line.
 *
 * Usage:
 *   node scripts/export-data.js <backup.json> [--format=json|csv] [--out=path]
 *
 * Examples:
 *   node scripts/export-data.js backup.json
 *   node scripts/export-data.js backup.json --format=csv --out=interviews.csv
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { input: null, format: 'json', out: null };
  argv.forEach((arg) => {
    if (arg.startsWith('--format=')) {
      args.format = arg.split('=')[1];
    } else if (arg.startsWith('--out=')) {
      args.out = arg.split('=')[1];
    } else if (!arg.startsWith('--')) {
      args.input = arg;
    }
  });
  return args;
}

function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function interviewsToCsv(interviews) {
  const header = [
    'Candidate',
    'Domain',
    'Interviewer',
    'Date',
    'Status',
    'Technical Score',
    'Behavioral Score',
    'SDLC Score',
    'Recommendation',
    'Overall Assessment',
  ];
  const rows = interviews.map((iv) => [
    iv.candidateName,
    iv.domainName,
    iv.interviewer,
    iv.date,
    iv.status,
    iv.technicalScore ?? '',
    iv.behavioralScore ?? '',
    iv.sdlcScore ?? '',
    iv.recommendation ?? '',
    iv.overallAssessment ?? '',
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input) {
    console.error('Usage: node scripts/export-data.js <backup.json> [--format=json|csv] [--out=path]');
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), args.input);
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  let backup;
  try {
    backup = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch (error) {
    console.error('Failed to parse backup file as JSON:', error.message);
    process.exit(1);
  }

  const interviews = Array.isArray(backup.interviews) ? backup.interviews : [];
  if (!interviews.length) {
    console.error('No interviews found in this backup file.');
    process.exit(1);
  }

  let output;
  let defaultExt;
  if (args.format === 'csv') {
    output = interviewsToCsv(interviews);
    defaultExt = 'csv';
  } else {
    output = JSON.stringify(interviews, null, 2);
    defaultExt = 'json';
  }

  const outPath = args.out
    ? path.resolve(process.cwd(), args.out)
    : path.resolve(process.cwd(), `interviews-export.${defaultExt}`);

  fs.writeFileSync(outPath, output, 'utf8');
  console.log(`Exported ${interviews.length} interview(s) to ${outPath}`);
}

main();
