import derive from './ops/derive';
import queries from './ops/query';
import aggregate from './ops/aggregate';
import match from './ops/match';

export default function pipeline (data){
    var queue = [],
        cache = {},
        opt = {},
        workers = [],
        completed = 0,
        result = [],
        callback = function() {};

    if(Array.isArray(data)) {
        result = data;
    }

    opt.derive = derive;
    opt.match = match;
    opt.aggregate = aggregate;

    Object.keys(queries).forEach(function(f) {
        opt[f] = queries[f];
    });

    opt.cache = function(data, tag){
        cache[tag] = pipeline.result();
    };

    opt.map = function(f){
        result = data.map(f);
        return pipeline;
    };

    var merge = {
        aggregate: function (lastJob) {
            var mergeSpec = {};
            for(var key in lastJob.aggregate) {
                var optSpec = lastJob.aggregate[key];
                if(typeof optSpec == 'object')
                    mergeSpec[key] = Object.keys(optSpec)[0];
                else
                    mergeSpec[key] = optSpec;
            }
            return opt.aggregate(finalResult, mergeSpec);
        }
    }

    var finalResult = [];

    function mergeResult(workerResult) {
        var rl = finalResult.length,
            wl = workerResult.length;
        for(var i = 0; i < wl; i++) {
            finalResult[rl+i] = workerResult[i];
        }
        completed += 1;

        if(completed == workers.length) {
            var lastJob = queue[queue.length-1],
                lastJobOpt = Object.keys(lastJob)[0];
            if( lastJobOpt == 'aggregate') {
                finalResult = merge.aggregate(lastJob);
            }
            callback(finalResult);
        }
    }

    var pipeline = {};

    // pipeline.opt = opt;
    Object.keys(opt).forEach(function(o){
        pipeline[o] = function(spec) {
            var task = {};
            task[o] = spec;
            queue.push(task);
            return pipeline;
        };
    })

    pipeline.then = function(_callback) {
        callback = _callback;
        queue.forEach(function(q){
            var f = Object.keys(q)[0];
            result = opt[f](result, q[f]);
        });
        return result;
    }

    pipeline.execute = function(data) {
        if(Array.isArray(data)) result = data;
        queue.forEach(function(q){
            var f = Object.keys(q)[0];
            result = opt[f](result, q[f]);
        });
        return result;
    }

    pipeline.oncomplete = pipeline.then;

    pipeline.result = function() {
        return result;
    };

    pipeline.data = function(data) {
        result = data;
        return pipeline
    }

    pipeline.queue = function() {
        return queue;
    }

    pipeline.runSpec = function(specs) {
        specs.forEach(function(spec){
            let opt = Object.keys(spec)[0];
            pipeline[opt.replace('$', '')](spec[opt])
        })
        return pipeline.execute();
    }

    return pipeline;
}
