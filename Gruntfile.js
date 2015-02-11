'use strict';

/* globals module */

module.exports = function(grunt) {

  // configure project
  grunt.initConfig({
    csslint: {
      options: {
        csslintrc: 'build/csslintrc'
      },
      strict: {
        options: {
          import: 2
        },
        src: [
          '**/*.css',
          '!**/*_nolint.css',
          '!components/**',
          '!node_modules/**'
        ]
      }
    },

    htmlhint: {
      html1: {
        src: [
          // TODO: fix rule and enable html linting.
          '!**/*.html',
          '!components/**',
          '!node_modules/**'
        ]
      }
    },

    jscs: {
      src: '**/*.js',
      options: {
        preset: 'google', // as per Google style guide – could use '.jscsrc' instead
        excludeFiles: [
          'components/**',
          'node_modules/**'
        ]
      }
    },

    jshint: {
      options: {
        ignores: [
          'components/**',
          'node_modules/**'
        ],
        jshintrc: 'build/jshintrc'
      },
      // files to validate
      // can choose more than one name + array of paths
      // usage with this name: grunt jshint:files
      files: ['**/*.js']
    },
  });

  // enable plugins
  grunt.loadNpmTasks('grunt-contrib-csslint');
  grunt.loadNpmTasks('grunt-htmlhint');
  grunt.loadNpmTasks('grunt-jscs');
  grunt.loadNpmTasks('grunt-contrib-jshint');

  // set default tasks to run when grunt is called without parameters
  grunt.registerTask('default', ['csslint', 'htmlhint', 'jscs', 'jshint']);
};
