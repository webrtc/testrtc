/*  Array functions are under following copyright:
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* eslint-disable */ /* disable linting on upstream WebRTC code */

'use strict';
/* helper functions */

// check and warning icons that all the tests use
var checkmark = '<ts-icon class="ts_icon_check_circle_o_large checkmark_settings icon_position_settings"></ts-icon>';
var warning = '<ts-icon class="ts_icon_warning warning_settings icon_position_settings"></ts-icon>';

// array<function> returns the average (down to nearest int), max and min of
// an int array.
function arrayAverage(array) {
	var cnt = array.length;
	var tot = 0;
	for (var i = 0; i < cnt; i++) {
		tot += array[i];
	}
	return Math.floor(tot / cnt);
}

function arrayMax(array) {
	if (array.length === 0) {
		return NaN;
	}
	return Math.max.apply(Math, array);
}

function arrayMin(array) {
	if (array.length === 0) {
		return NaN;
	}
	return Math.min.apply(Math, array);
}

// removes testing styling for every test after section has finished running
function removeTestingStyling(sectionHeaderTag, sectionRunningIconTag){
	$(sectionHeaderTag).removeClass("section_testing");
	$(sectionRunningIconTag).removeClass("show");
	$(sectionRunningIconTag).addClass("hidden");
}

//escapes periods in tag ids for the sake of jQuery selection
function regexCorrect(tag_id){
	return tag_id.replace( /(:|\.|\[|\]|,|=|@)/g, "\\$1" );
}

//iterates through child list items and updates their style for pass or fail
function updateChildListItems(parent_ul_tag){
	var list_items = $(parent_ul_tag).children('li');
	list_items.each(function(){
		var list_item = $(this);
		if(list_item.hasClass("pass_flag")){
			list_item.addClass("pass");
		} else if (list_item.hasClass("fail_flag")){
			list_item.addClass("fail");
		}
	})
}

function addCautionToHeader(fail_span_tag, currentWarning){
	fail_span_tag.removeClass("hidden");
	fail_span_tag.addClass("show");
	var pluralString = (currentWarning > 1) ? "s" : ""; // plural ending if > 1 warning
	fail_span_tag.text(currentWarning + " warning" + pluralString);
	fail_span_tag.append(warning);
}

function setTestingHeader(headerTag, waitingTag, runningTag){
		headerTag.addClass("section_testing");
		waitingTag.addClass("hidden");
		runningTag.removeClass("hidden");
		runningTag.addClass("show");
}

function setFail(resultTag, testTag, headerTag, failText){
	resultTag.prev("span").addClass("emphasis");
	resultTag.text(failText);
	resultTag.append(warning);
	testTag.addClass("fail_flag");
	headerTag.addClass("fail_flag");
}

// adds results of test to full text variable if required for zendesk ticket
function addToFullText(testName, result){
	var new_text = testName + ": " + result.text();
	full_text += new_text;
}