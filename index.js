/*
 *  Copyright (c) 2017 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* expose VideoFrameChecker and Ssim as modules without exposing the internal
 * structure of the source code.
 */
'use strict';
module.exports = {
    Ssim: require('./src/js/ssim'),
    VideoFrameChecker: require('./src/js/videoframechecker')
};
