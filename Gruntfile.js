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
            'cron.yaml',
            'app.yaml',
            'testrtc.py',
            'node_modules/webrtc-adapter/out/adapter.js',
            'src/images/**'
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
          inlineCss: true,
          stripComments: true,
          csp: 'main.js'
        },
        files: {
          'out/src/index.html': 'src/index.html'
        }
      }
    },

    csslint: {
      strict: {
        options: {
          import: 2
        },
        src: [
          '**/*.css',
          '!**/*_nolint.css',
          '!browsers/**',
          '!components/**',
          '!node_modules/**',
          '!out/**'
        ]
      }
    },

    eslint: {
      target: ['!src/js/*.js']
    },

    htmllint: {
      all: [
        // TODO: fix rule and enable html linting.
        '!**/*.html',
        '!browsers/**',
        '!components/**',
        '!node_modules/**',
        '!out/**'
      ]
    },

    uglify: {
      options: {
        compress: {
          global_defs: {
            'API_KEY': process.env.API_KEY,
            'TURN_URL': 'https://networktraversal.googleapis.com/v1alpha/iceconfig?key='
          },
          dead_code: true,
        },
        // Enable when you want debug the code.
        beautify: false,
        mangle: true
      },
      target: {
        files: {
          'out/src/main.js': ['out/src/main.js']
        }
      }
    },

  });

  // enable plugins
  grunt.loadNpmTasks('grunt-contrib-csslint');
  grunt.loadNpmTasks('grunt-html');
  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-vulcanize');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  // Set default tasks to run when grunt is called without parameters
  grunt.registerTask('default', ['csslint', 'htmllint', 'eslint']);

  // Cleans out/ folder, copies files in place and vulcanizes index.html to out/.
  grunt.registerTask('build', ['clean', 'copy', 'vulcanize', 'uglify']);
};
