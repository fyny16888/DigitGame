// Copyright 2015 MemDB.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License. See the AUTHORS file
// for names of contributors.

'use strict';

/*
 * quick pomelo template project
 *
 * start memdb first by:
 * memdbcluster start -c ./config/memdb.conf.js
 */

var util = require('util');
var pomelo = require('pomelo');
var quick = require('quick-pomelo');
var pomeloConstants = require('pomelo/lib/util/constants');
var P = quick.Promise;
var logger = quick.logger.getLogger('pomelo', __filename);
var pomeloLogger = require('pomelo/node_modules/pomelo-logger');

var app = pomelo.createApp();
app.set('name', 'digitgame');

// configure for global
app.configure('all', function() {

    app.enable('systemMonitor');

    app.set('proxyConfig', {
        bufferMsg : true,
        interval : 30,
        lazyConnection : true,
        timeout : 15 * 1000,
        failMode : 'failfast',
    });

    app.set('remoteConfig', {
        bufferMsg : true,
        interval : 30,
    });
    
    // Configure memdb
    app.loadConfigBaseApp('memdbConfig', 'memdb.json');

    // Load components
    app.load(quick.components.memdb);
    app.load(quick.components.controllers);
    app.load(quick.components.routes);
    app.load(quick.components.timer);

    // Configure logger
    var loggerConfig = app.getBase() + '/config/log4js.json';
    var loggerOpts = {
        serverId : app.getServerId(),
        base: app.getBase(),
    };
    quick.logger.configure(loggerConfig, loggerOpts);

    // Configure filter
    if (app.getServerType() != 'gate') {
        app.filter(quick.filters.transaction(app));
    }
    // app.globalFilter(quick.filters.reqId(app));

    // Add beforeStop hook
    app.lifecycleCbs[pomeloConstants.LIFECYCLE.BEFORE_SHUTDOWN] = function(app, shutdown, cancelShutDownTimer){
        cancelShutDownTimer();

        if(app.getServerType() === 'master'){

            // Wait for all server stop
            var tryShutdown = function(){
                if(Object.keys(app.getServers()).length === 0){
                    quick.logger.shutdown(shutdown);
                }
                else{
                    setTimeout(tryShutdown, 200);
                }
            };
            tryShutdown();
            return;
        }

        quick.logger.shutdown(shutdown);
    };

    app.set('errorHandler', function(err, msg, resp, session, cb){
        resp = {
            code : 500,
            stack : err.stack,
            message : err.message,
        };
        cb(err, resp);
    });
});

//Gate settings
app.configure('all', 'gate', function() {
    app.set('connectorConfig', {
        connector : pomelo.connectors.hybridconnector,
        heartbeat : 30,
    });

    app.set('sessionConfig', {
        singleSession : true,
    });
});

//Connector settings
app.configure('all', 'connector', function() {
    app.set('connectorConfig', {
        connector : pomelo.connectors.hybridconnector,
        heartbeat : 30,
        disconnectOnTimeout : true
    });

    app.set('sessionConfig', {
        singleSession : true,
    });
});

// Game route
app.configure('production|development', function () {
    app.route('ddz', 	require('./gameRoute').ddzRoute);
    app.route('tw', 	require('./gameRoute').twRoute);
    app.route('to', 	require('./gameRoute').toRoute);
    app.route('pk', 	require('./gameRoute').pkRoute);
    app.route('fruit',  require('./gameRoute').fruitRoute);
    app.route('clown',  require('./gameRoute').clownRoute);
    app.route('animal', require('./gameRoute').animalRoute);
    app.route('golden', require('./gameRoute').goldenRoute);
    app.route('niuniu', require('./gameRoute').niuniuRoute);
});

// Http server
if (app.getServerType() == 'http') {
    let entryJs = app.getCurServer().entryJs;
    if (entryJs) {
        require(`./http/${entryJs}`)(app);
    }
}

app.configure('development', function(){
    require('heapdump');
    quick.Promise.longStackTraces();
    quick.logger.setGlobalLogLevel(quick.logger.levels.WARN);
    pomeloLogger.setGlobalLogLevel(pomeloLogger.levels.WARN);
});

app.configure('production', function(){
    quick.logger.setGlobalLogLevel(quick.logger.levels.WARN);
    pomeloLogger.setGlobalLogLevel(pomeloLogger.levels.WARN);
});

process.on('uncaughtException', function(err) {
    logger.error('Uncaught exception: %s', err.stack);
});

app.start();

