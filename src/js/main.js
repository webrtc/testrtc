var call_tests = [];

function main() {
	setupHTML();
	call_tests = [new MicTest(nextCallTest), new CamResolutionsTest(nextCallTest), new NetworkTest('udp', null, Call.isRelay, nextCallTest, false), new NetworkTest('tcp', null, Call.isRelay, nextCallTest, false), new NetworkTest('tcp', null, Call.isRelay, nextCallTest, true), new RunConnectivityTest(Call.isRelay, nextCallTest), new DataChannelThroughputTest(nextCallTest), new VideoBandwidthTest(nextCallTest)]; // eslint-disable-line no-undef
}

function setupHTML() {
	var mic = $('<li id="mic-test"><span>Microphone	 </span> <span id="mic-test-result" class = "check">waiting</span></li>');
	var camera = $('<li id="cam-test"><span>Camera </span> <span id="cam-test-result" class = "check">waiting</span></li>');
	var network = $('<li id="net-test"><span>Network UDP </span> <span id="net-test-result" class = "check">waiting</span></li>');
	var network2 = $('<li id="net-test2"><span>Network TCP </span> <span id="net-test-result2" class = "check">waiting</span></li>');
	var network3 = $('<li id="net-test3"><span>Network TCP/TLS </span> <span id="net-test-result3" class = "check">waiting</span></li>');
	var connectivity = $('<li id="conn-test"><span>Relay Connectivity </span> <span id="conn-test-result" class = "check">waiting</span></li>');
	var throughput = $('<li id="datathroughput-test"><span>Data Throughput</span> <span id="datathroughput-test-result" class = "check">waiting</span></li>');
	var throughput2 = $('<li id="videobandwidth-test"><span>Video Throughput</span> <span id="videobandwidth-test-result" class = "check">waiting</span></li>');

	var mic_tags = [mic];
	var camera_tags = [camera];
	var network_tags = [network, network2, network3];
	var connectivity_tags = [connectivity];
	var throughput_tags = [throughput, throughput2];

	//append tags to appropriate lists in page_help_test_calls.txt
	mic_tags.forEach(function(tag) {
		$('#mic-tests').append(tag);
	});
	camera_tags.forEach(function(tag) {
		$('#camera-tests').append(tag);
	});
	network_tags.forEach(function(tag) {
		$('#network-tests').append(tag);
	});
	connectivity_tags.forEach(function(tag) {
		$('#connectivity-tests').append(tag);
	});
	throughput_tags.forEach(function(tag) {
		$('#throughput-tests').append(tag);
	});
}

function startTests() { // eslint-disable-line no-unused-vars
	nextCallTest();
}

function nextCallTest() {
	if (call_tests.length) {
		var callT = call_tests.shift();
		callT.run();
	} else {
		allTestsDone('calls'); // eslint-disable-line no-undef
	}
}


main();
