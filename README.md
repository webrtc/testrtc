[![Build Status](https://travis-ci.org/webrtc/testrtc.svg)](https://travis-ci.org/webrtc/testrtc)

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
* Network
  * Udp/Tcp
    * Verifies it can talk with a turn server with the given protocol
  * IPv6 connectivity
    * Verifies it can gather at least one IPv6 candidate
* Connectivity
  * Relay
    * Verifies connections can be established between peers through a TURN server
  * Reflexive
    * Verifies connections can be established between peers through NAT
  * Host
    * Verifies connections can be established between peers with the same IP address
* Throughput
  * Data throughput
    * Establishes a loopback call and tests data channels throughput on the link
  * Video bandwidth
    * Establishes a loopback call and tests video performance on the link
    * Measures rtt on media channels.
    * Measures bandwidth estimation performance (rampup time, max, average)

## Manual tests ##
Due to their time duration they are not part of the normal test suite and need to be run explicitly.
* [Network latency](https://test.webrtc.org/?test_filter=Network%20latency)
  * Establishs a loopback call and sends very small packets (via data channels) during 5 minutes plotting them to the user. It can be used to identify issues on the network.

## Contributing ##
Pull requests and issues welcome! See [CONTRIBUTING](https://github.com/GoogleChrome/webrtc/blob/master/CONTRIBUTING.md) for instructions. All contributors must sign a contributor license agreement before code can be accepted. Please complete the agreement for an [individual](https://developers.google.com/open-source/cla/individual) or a [corporation](https://developers.google.com/open-source/cla/corporate) as appropriate. The [Developer's Guide](https://bit.ly/webrtcdevguide) for this repo has more information about code style, structure and validation.

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

#### Run vulcanized version of TestRTC using [Google App Engine SDK for Python](https://cloud.google.com/appengine/downloads) (requires the Build testrtc step to be performed first). ####
```bash
python dev_appserver.py out/app.yml
```
