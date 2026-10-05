const fs = require('node:fs');
const vm = require('node:vm');
const { calendarFile } = require('../party.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync('site-config.js', 'utf8'), context);
fs.writeFileSync('event.ics', calendarFile(context.window.ELAB_CONFIG.event));
console.log('Generated event.ics from site-config.js');
