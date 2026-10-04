class AdminReporter {
  onTestEnd(test, result) {
    for (const error of result.errors) {
      process.stdout.write(`${test.title}: ${error.stack ?? error.message}\n`);
    }
  }
}

module.exports = AdminReporter;
