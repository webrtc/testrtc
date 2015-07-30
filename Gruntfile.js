'use strict';

/* globals module */

module.exports = function(grunt) {

  // configure project
  grunt.initConfig({
    copy: {
      build: {
        cwd: '.',
        files: [
          {src: [
            'cron.yml',
            'app.yaml',
            'testrtc.py',
            'src/manual/**',
            'components/webrtc-adapter/adapter.js'
            ],
            dest: 'out',
            nonull: true,
            expand: true
          }
        ]
      }
    },

    clean: {
      build: {
        src: ['out/*']
      }
    },

    vulcanize: {
      default: {
        options: {
          inlineScripts: true,
          inlineCss: true
        },
        files: {
          'out/src/index.html': 'src/index.html'
        }
      }
    },

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
          '!browsers/**',
          '!components/**',
          '!google_appengine/**',
          '!node_modules/**',
          '!out/**'
        ]
      }
    },

    htmlhint: {
      html1: {
        src: [
          // TODO: fix rule and enable html linting.
          '!**/*.html',
          '!browsers/**',
          '!components/**',
          '!google_appengine/**',
          '!node_modules/**',
          '!out/**'
        ]
      }
    },

    jscs: {
      src: '**/*.js',
      options: {
        preset: 'google', // as per Google style guide – could use '.jscsrc' instead
        excludeFiles: [
          'browsers/**',
          'components/**',
          'google_appengine/**',
          'node_modules/**',
          'out/**'
        ]
      }
    },

    jshint: {
      options: {
        ignores: [
          'browsers/**',
          'components/**',
          'google_appengine/**',
          'node_modules/**',
          'out/**'
        ],
        jshintrc: 'build/jshintrc'
      },
      // Files to validate
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
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-vulcanize');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-clean');

  // Set default tasks to run when grunt is called without parameters
  grunt.registerTask('default', ['csslint', 'htmlhint', 'jscs', 'jshint']);

  // Cleans out/ folder, copies files in place and vulcanizes index.html to out/.
  grunt.registerTask('build', ['clean', 'copy', 'vulcanize']);
};
