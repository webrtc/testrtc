/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';
// This is a basic test file for use with testling.
// The test script language comes from tape.
/* jshint node: true */
var test = require('tape');

var webdriver = require('selenium-webdriver');
var seleniumHelpers = require('webrtc-utilities').seleniumLib;

test('Run TestRTC', function(t) {
  // FIXME: use env[SELENIUM_BROWSER] instead?
  var driver = seleniumHelpers.buildDriver();

  driver.get('file://' + process.cwd() + '/out/src/index.html')
  .then(function() {
    t.pass('Page loaded');
  })
  .then(function() {
    return driver.wait(webdriver.until.elementLocated(
        webdriver.By.css('#startButton')), 10000,
        'Failed to locate startButton');
  })
  .then(function(element) {
    t.pass('Located startButton');
    return element.click();
  })
  .then(function() {
    t.pass('Clicked on startButton.');
    // webdriver.until.elementIsDisabled() does not work for some reason.
    // http://seleniumhq.github.io/selenium/docs/api/javascript/class_webdriver_until_Condition.html
    var isElementDisabled = function(element) {
      return new webdriver.until.Condition('wait until disabled', function() {
        return element.getAttribute('disabled').then(function(callback) {
          return !callback;
        });
      });
    };

    return driver.wait(isElementDisabled(driver
        .findElement(webdriver.By.css('#startButton'))), 90 * 1000,
        'startButton is not enabled');
  })
  // TODO: Dump console.log contents to stderr.
  .then(function() {
    t.pass('startButton is active. Test execution completed.');
    t.end();
  })
  .then(null, function(err) {
    t.fail(err);
    t.end();
  });
});
