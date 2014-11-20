#!/usr/bin/env node
'use strict';

var superdeis = require('../src/'),
    updateNotifier = require('update-notifier'),
    notifier = updateNotifier({ packagePath: '../package' });

if (notifier.update) {
    notifier.notify();
}
