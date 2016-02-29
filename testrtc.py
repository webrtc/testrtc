#!/usr/bin/python
#
# Copyright 2014 Google Inc. All Rights Reserved.

"""
This module handles log file upload and download, delete log files from the
    blobstore (only allowed via a cron job) at a set interval and also creates
    a 10Mb downloadable file useful for bandwidth benchmarking.
"""
import cgi
import logging
import random
import os
import webapp2
import urllib
import datetime
import re

from google.appengine.ext import blobstore
from google.appengine.ext.webapp import blobstore_handlers

# Generate 10 kilobytes of random data and create a 10MB buffer from it.
random_file = bytearray([random.randint(0,127) for i in xrange(0,10000)] * 1000)

class TestDownloadFile(webapp2.RequestHandler):
  def get(self, size_kbytes):
    self.response.headers.add_header("Access-Control-Allow-Origin", "*")
    self.response.headers['Content-Type'] = 'application/octet-stream'
    self.response.out.write(random_file[0: int(size_kbytes)*1000])

class NewReportHandler(blobstore_handlers.BlobstoreUploadHandler):
  # Generate and return blobstore upload URL.
  def head(self):
    upload_url = blobstore.create_upload_url('/report/new')
    self.response.headers['Response-Text'] = upload_url

  # On uploaded file to the blobstore.
  def post(self):
    origin = self.request.headers['Origin']
    fileName = self.request.headers['X-File-Name']
    if not re.match(r'^testrtc-.*.log', fileName):
      return self.error(403)
    upload_files = self.get_uploads(field_name=fileName)
    blob_info = upload_files[0]
    self.response.headers['Content-Type'] = 'text/plain';
    self.response.headers['Response-Text'] = origin + '/report/%s' % blob_info.key()

class ReportHandler(blobstore_handlers.BlobstoreDownloadHandler):
  def get(self, resource):
    resource = str(urllib.unquote(resource))
    blob_info = blobstore.BlobInfo.get(resource)
    self.send_blob(blob_info)

# Remove log files equal or older than retentionPeriod.
class CleanBlobstore(blobstore_handlers.BlobstoreUploadHandler):
  def get(self):
    retentionPeriod = datetime.datetime.now() - datetime.timedelta(days=90)
    gqlQuery = blobstore.BlobInfo.gql("WHERE creation <= :date",
        date = retentionPeriod)
    logFiles = gqlQuery.run()
    for log in logFiles:
      # Make sure to only delete log reports from the blobstore.
      if re.match(r'^testrtc-.*.log', log.filename):
        blobstore.BlobInfo.get(log.key()).delete()

app = webapp2.WSGIApplication([
    ('/report/new', NewReportHandler),
    (r'/report/([^/]+)', ReportHandler),
    (r'/test-download-file/(\d?\d00)KB.data', TestDownloadFile),
    ('/tasks/blobstore/clean', CleanBlobstore)
  ], debug=True)
