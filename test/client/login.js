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

var quick = require('quick-pomelo');
var P = quick.Promise;
var logger = quick.logger.getLogger('test', __filename);

var main = function(){
	// var gateClient = {host : '123.206.55.167', port : 3010};
    // var connector1 = {host : '123.206.55.167', port : 3101};
    // var gateClient = {host : 'kaixuan-pc', port : 4010};
    // var connector1 = {host : 'kaixuan-pc', port : 4100};
    // var gateClient = {host : '211.149.207.220', port : 17010};
    // var connector1 = {host : '211.149.207.220', port : 17100};
    var gateClient = {host : '192.168.0.1', port : 7010};
    var connector1 = {host : '192.168.0.1', port : 7100};
    // var connector2 = {host : '192.168.1.139', port : 3100};

	var gate    = quick.mocks.client(gateClient);
    var client1 = quick.mocks.client(connector1);
    // var client2 = quick.mocks.client(connector2);
    // var client3 = quick.mocks.client(connector1);
    // var client4 = quick.mocks.client(connector2);

    var playerId = '997ee589-aa14-9ac0-b799-50d1e41b2640@my2016';

    return P.try(function(){
		// return gate.connect();
    })
    .then(function(){
        return client1.connect();
    })
    .then(function(){
		// return gate.request('gate.gateHandler.getConnector');
    })
    .then(function(){
        // return client1.request('player.playerHandler.create', {opts : {_id : playerId}});
    })
    .then(function(){
        return client1.request('connector.entryHandler.login', {_id : playerId});
    })
    .delay(6000)
    .then(function(){
		return client1.request('hall.hallHandler.getWinRank', {win: 1});
    })
    .then(function(){
		 client1.on('onKick', function(msg){
			 logger.info('on notify %j', msg);
		 });
		 client1.on('join', function(msg){
			 logger.info('on notify %j', msg);
		 });
		 client1.on('leave', function(msg){
			 logger.info('on notify %j', msg);
		 });
		// return client1.request('package.packageHandler.query', {type: '1'});
		// return client1.request('package.packageHandler.use', {pid: 1, num: 1});
		// return client2.connect();
    })
    .then(function(){
		// return client1.request('player.playerHandler.randname');
    })
    .then(function(){
		// return client1.request('hall.hallHandler.queryDDZTable');
		// return client1.request('hall.hallHandler.getRankList');
    })
    
    .then(function(){
		// return client1.request('game.niuniuHandler.leaveTable');
    })
    .then(function(){
		// return client1.request('connector.entryHandler.init');
    })
	.then(function(){
		// return client1.request('fight.layoutHandler.layout', { "name": "xxxxYY"});
    })
    .then(function(){
		// return client1.request('fight.fightHandler.fight');
    })
    
    .then(function(){
		// return client1.request('player.friendHandler.apply', {name: 'xxxxCC'});
    })
    .then(function(){
		// return client1.request('fight.layoutHandler.modify', [{hid:'0', pos: '1'}, {hid: 2001, pos: 5}]);
    })
    .then(function(){
    
		client1.on('chat', function(msg){
           logger.info('on chat notify %j', msg);
        });
        client1.on('pay', function(msg){
           logger.info('pay=====', msg);
        });
        
        // return client1.request('chat.chatHandler.send', {channel : 2, tid : 'xxxxBB', msg : 'hello world ___tr'});
        // return client1.request('fight.fightHandler.fight');
    })
    .then(function(){
		// return client1.request('player.mapHandler.site');
    })
    .then(function(){
		// return client1.request('player.mapHandler.move', { siteId: 110 });
    })
    .then(function(){
		// return client1.request('package.wealthHandler.ingot2silver', {ingot: 1});
    })
    .then(function(){
		// return client1.request('player.mapHandler.site');
    })
    .then(function(){
		// return client1.request('fight.fightHandler.pve', { pos: 1 });
    })
    .then(function(){
		// return client1.request('connector.entryHandler.nodeuser');
    })
    .then(function(){
		// client1.on('chat', function(msg){
        //     logger.info('on notify %j', msg);
        // });
        // return client1.request('package.packageHandler.add', {playerId: playerId, goodsId : 1, count : 1});
        // return client2.connect();
    })
    .then(function(){
        // return client1.request('chat.chatHandler.send', {channel: 1, tid : 'sss', route : 'chat', msg : 'hello  555555555555555'});
        // return client2.connect();
    })
    .then(function(){
        // return client1.request('connector.entryHandler.recommend');
    })
    .then(function(){
        // return client1.request('player.friendHandler.applist');
    })
    .then(function(){
		// return client1.request('player.friendHandler.agree', {name: 'FAdin', type: 1});
    }).then(function(){
		// return client1.request('player.friendHandler.sendto', {name: 'FAdin'});
    })
    .then(function(){
		// return client1.request('player.friendHandler.present');
    })
    .then(function(){
        // return client1.request('player.friendHandler.recvfrom', {name: 'xxxxBB'});
    })
    .then(function(){
        // return client1.request('player.friendHandler.friends', {type: 0});
    })
    .then(function(){
		// return client1.request('player.friendHandler.friends', {type: 1});
    })
    .then(function(){
        // return client1.request('player.friendHandler.intoblack', {name: 'xxxxx2'});
        // return client1.request('player.friendHandler.friends', {type: 2});
    })
    .then(function(){
        // return client2.connect();
    })
    .then(function(){
        // Client1 should be kicked out
        // return client2.request('connector.entryHandler.login', {token : playerId});
    })
    .then(function(){
        // Explicitly call logout
        // return client2.request('connector.entryHandler.logout');
    })
    .then(function(){
        // return client3.connect();
    }) 
    .then(function(){
       //  return client3.request('connector.entryHandler.login', {token : playerId});
    })
    // .delay(100000)
    .then(function(){
		// return client1.request('connector.entryHandler.logout');
	}
    )
    .then(function(){
        // Auto logout on disconnect
        // return client3.disconnect();
		// return client1.disconnect();
    })
    .delay(100)
    .then(function(){
        // return client4.connect();
    })
    .then(function(){
        // return client4.request('connector.entryHandler.login', {token : playerId});
    })
    .then(function(){
        // Remove and logout
        // return client4.request('player.playerHandler.remove');
    })
    .then(function(){
        // return client4.disconnect();
    })
    .catch(function(e){
        logger.error('%j', e);
    })
    .finally(function(){
        // process.exit();
    });
};

if (require.main === module) {
    main();
}
