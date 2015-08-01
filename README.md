[![Build Status](https://travis-ci.org/webrtc/testrtc.svg?branch=master)](https://travis-ci.org/webrtc/testrtc)

# TestRTC #
[WebRTC troubleshooter](https://test.webrtc.org/) provides a set of tests that can be easily run by a user to help diagnose
WebRTC related issues. The user can then download a report containing all the gathered information or upload the log and
create a temporary link with the report result.

## Automatic tests ##
* Microphone
  * Audio capture
    * Checks the microphone is able to produce 2 seconds of non-silent audio
    * Computes peak level and maximum RMS
    * Clip detection
    * Mono mic detection
* Camera
  * Check WxH resolution
    * Checks the camera is able to capture at the requested resolution for 5 seconds
    * Checks if the frames are frozen or muted/black
    * Detects how long to start encode frames
    * Reports encode time and average framerate
  * Check supported resolutions
    * Lists resolutions that appear to be supported
* Connectivity
  * Udp/Tcp connectivity
    * Verifies it can talk with a turn server with the given protocol
  * IPv6 connectivity
    * Verifies it can gather at least one IPv6 candidate
  * Data throughput
    * Establishes a loopback call and tests data channels throughput on the link
  * Video bandwidth
    * Establishes a loopback call and tests video performance on the link
    * Measures rtt on media channels.
    * Measures bandwidth estimation performance (rampup time, max, average)

## Manual tests ##
Due to their time duration they are not part of the normal test suite and need to be run explicitly.
* [Network latency](https://test.webrtc.org/?test_filter=Network latency)
  * Establishs a loopback call and sends very small packets (via data channels) during 5 minutes plotting them to the user. It can be used to identify issues on the network.

## Other manual test pages ##
* [Audio and Video streams](https://test.webrtc.org/manual/audio-and-video/)
* [Iframe apprtc](https://test.webrtc.org/manual/iframe-apprtc/)
* [Iframe video](https://test.webrtc.org/manual/iframe-video/)
* [Multiple audio streams](https://test.webrtc.org/manual/multiple-audio/)
* [Multiple peerconnections](https://test.webrtc.org/manual/multiple-peerconnections/)
* [Multiple video devices](https://test.webrtc.org/manual/multiple-video-devices/)
* [Multiple video streams](https://test.webrtc.org/manual/multiple-video/)
* [Peer2peer](https://test.webrtc.org/manual/peer2peer/)
* [Peer2peer iframe](https://test.webrtc.org/manual/peer2peer-iframe/)
* [Single audio stream](https://test.webrtc.org/manual/single-audio/)
* [Single video stream](https://test.webrtc.org/manual/single-video/)

## Contributing ##
Patches and issues welcome! See [CONTRIBUTING](https://github.com/GoogleChrome/webrtc/blob/master/CONTRIBUTING.md) for instructions. All contributors must sign a contributor license agreement before code can be accepted. Please complete the agreement for an [individual](https://developers.google.com/open-source/cla/individual) or a [corporation](https://developers.google.com/open-source/cla/corporate) as appropriate. The [Developer's Guide](https://bit.ly/webrtcdevguide) for this repo has more information about code style, structure and validation.

## Development ##
Make sure to install NodeJS and NPM before continuing. Note that we have been mainly been using Posix when developing TestRTC hence developer tools might not work correctly on Windows.

#### Install developer tools and frameworks ####
```bash
npm install
```

#### Install dependencies ####
```bash
bower update
```

#### Run linters (currently very limited set is run) ####
```bash
grunt
```

#### Build testrtc ####
Cleans out/ folder if it exists else it's created, then it copies and vulcanizes the resources needed to deploy this on Google App Engine.
```
grunt build
```

#### Run non vulcanized version of TestRTC using [Google App Engine SDK for Python](https://cloud.google.com/appengine/downloads). This is useful while developing. ####
```bash
python dev_appserver.py app.yml
```

#### Run vulcanized version of TestRTC using [Google App Engine SDK for Python](https://cloud.google.com/appengine/downloads) (Requires the Build testrtc step to be performed first). ####
```bash
python dev_appserver.py out/app.yml
```

### Testing ###
Selenium WebDriver, Node, Testling and travis-multirunner are used as the testing framework. Selenium WebDriver drives the browser; Node and Testling manage the tests, while travis-multirunner downloads and installs the browsers to be tested on, i.e. creates the testing matrix.

This guide assumes you are running a Debian based Linux distribution (travis-multirunner currently fetches .deb browser packages).

#### Run tests ####
Runs grunt and tests in test/tests.js.
```bash
npm test
```

#### Run individual tests ####
Runs only the specified test using the specified browser.
```bash
BROWSER=chrome node test/sanity-test.js
```

#### Choose browser and release channel ####
Runs the specified test using the specified browser and release channel.
```bash
BROWSER=chrome BVER=beta npm test
```

#### Add tests ####
test/tests.js is used as an index for the tests, tests should be added here using `require()`.
The tests themselves should be placed in the same js folder as main.js: e.g.test/sanity-test.js`.

The tests should be written using Testling for test validation (using Tape script language) and Selenium WebDriver is used to control and drive the test in the browser.

Use the existing tests as guide on how to write tests and also look at the [Testling guide](https://ci.testling.com/guide/tape) and [Selenium WebDriver](http://www.seleniumhq.org/docs/03_webdriver.jsp) (make sure to select javascript as language preference.) for more information.

Global Selenium WebDriver settings can be found in `test/selenium-lib.js`, if your test require some specific settings not covered in selenium-lib.js, add your own to the test and do not import the selenium-lib.js file into the test, only do this if it's REALLY necessary.

Once your test is ready, create a pull request and see how it runs on travis-multirunner.

#### Change browser and channel/version for testing ####
Chrome stable is currently installed as the default browser for the tests.

Currently Chrome and Firefox are supported[*](#-experimental-browser-support), check [travis-multirunner](https://github.com/DamonOehlman/travis-multirunner/blob/master/) repo for updates around this.
Firefox channels supported are stable, beta and nightly.
Chrome channels supported on Linux are stable, beta and unstable.

To select a different browser and/or channel version, change environment variables BROWSER and BVER, then you can rerun the tests with the new browser.
```bash
export BROWSER=firefox BVER=nightly
```

Alternatively you can also do it without changing environment variables.
```bash
BROWSER=firefox BVER=nightly npm test
```

###* Experimental browser support###
You can run the tests in any currently installed browser locally that is supported by Selenium WebDriver but you have to bypass travis-multirunner. Also it only makes sense to use a WebRTC supported browser.
* Remove the `.setBinary()` and `.setChromeBinaryPath()` methods in `test/selenium-lib.js` (these currently point to travis-multirunner scripts that only run on Debian based Linux distributions) or change them to point to a location of your choice.
* Then add the Selenium driver of the browser you want to use to `test/selenium-lib.js`, check Selenium WebDriver [supported browsers](http://www.seleniumhq.org/about/platforms.jsp#browsers) page for more details.
* Then just do the following (replace "opera" with your browser of choice) in order to run all tests
```bash
BROWSER=opera npm test
```
* If you want to run a specific test do the following
```bash
BROWSER=opera node test/sanity-test.js
```