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

var env = require('../env');
var quick = require('quick-pomelo');
var P = quick.Promise;
var logger = quick.logger.getLogger('test', __filename);

describe('team test', function(){
    beforeEach(env.initMemdbSync);
    afterEach(env.closeMemdbSync);

    it('team test', function(cb){
        var app = env.createApp('team-server-1', 'team');

        return P.try(function(){
            return P.promisify(app.start, app)();
        })
        .then(function(){
            var teamController = app.controllers.team;
            var playerController = app.controllers.player;
            var goose = app.memdb.goose;
            return goose.transaction(function(){
                var teamId = 't1', playerId = 'p1';
                return P.try(function(){
                    return playerController.createAsync({_id : playerId, name : 'rain'});
                })
                .then(function(){
                    return teamController.createAsync({_id : teamId, name : 'team1'});
                })
                .then(function(){
                    return teamController.joinAsync(teamId, playerId);
                })
                .then(function(){
                    return teamController.getPlayersAsync(teamId)
                    .then(function(players){
                        players.length.should.eql(1);
                        players[0]._id.should.eql(playerId);
                    });
                })
                .then(function(){
                    return playerController.connectAsync(playerId, 'c1');
                })
                .then(function(){
                    return teamController.pushAsync(teamId, null, 'chat', 'hello', true);
                })
                .then(function(){
                    return teamController.getMsgsAsync(teamId, 0)
                    .then(function(msgs){
                        msgs.length.should.eql(1);
                        msgs[0].msg.should.eql('hello');
                    });
                })
                .then(function(){
                    //Should automatically quit team
                    return playerController.removeAsync(playerId);
                })
                .then(function(){
                    return teamController.removeAsync(teamId);
                });
            }, app.getServerId());
        })
        .then(function(){
            return P.promisify(app.stop, app)();
        })
        .nodeify(cb);
    });
});
