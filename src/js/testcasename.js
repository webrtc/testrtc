/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
/* exported testCaseName */
'use strict';

/*  In order to make strings easier to translate all test case names should be
 *  added here.
 *  TODO: Add/create new file containing the remainder of strings like error
 *  messages and general information.
 */

// Enumerate test case names.
function TestCaseNames() {
  this.testCases = {
    AUDIOCAPTURE: 'Audio capture',
    CHECKRESOLUTION240: 'Check resolution 320x240',
    CHECKRESOLUTION480: 'Check resolution 640x480',
    CHECKRESOLUTION720: 'Check resolution 1280x720',
    CHECKSUPPORTEDRESOLUTIONS: 'Check supported resolutions',
    DATATHROUGHPUT: 'Data throughput',
    IPV6ENABLED: 'Ipv6 enabled',
    NETWORKLATENCY: 'Network latency',
    NETWORKLATENCYRELAY: 'Network latency - Relay',
    UDPENABLED: 'Udp enabled',
    TCPENABLED: 'Tcp enabled',
    VIDEOBANDWIDTH: 'Video bandwidth',
    RELAYCONNECTIVITY: 'Relay connectivity',
    REFLEXIVECONNECTIVITY: 'Reflexive connectivity',
    HOSTCONNECTIVITY: 'Host connectivity'
  };
  return this.testCases;
}

var testCaseName = new TestCaseNames();
