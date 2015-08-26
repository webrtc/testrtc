/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
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
    CHECKSUPPORTEDRESOLUTION: 'Check supported resolutions',
    CHECKRESOLUTION: 'Check resolution: ',
    DATATHROUGHPUT: 'Data throughput',
    IPV6ENABLED: 'Ipv6 enabled',
    NETWORKLATENCY: 'Network latency',
    NETWORKLATENCYRELAY: 'Network latency - Relay',
    UDPCONNECTIVITY: 'Udp connectivity',
    TCPCONNECTIVITY: 'Tcp connectivity',
    VIDEOBANDWIDTH: 'Video bandwidth'
  };
  return this.testCases;
}

var testCaseName = new TestCaseNames();
