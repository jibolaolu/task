/**
 * The strategy is to read data into memory at the start. Ideally  in-memory key-value store like memcached or Redis will be more appropriate
 * In order to avoid bursting active cache in order to update, data is copied to secondary cache, then the secondary cache becomes active
 *  
 *
 * To DO
 * ======
 * Refactoring. Code cleanup etc
 * Implement Infrastructure components to track memory and cpu utilization
 * Reactive to hihg/low usage of resource
 * study memory footprint to see if the approach used won't leak to memory leak
 * Logic to ensure dynamic parameters in a url are treated specially, so that different variants even if not exactly
 * matching in DB are analyzed.
 * 
 * To Test
 * =======
 * if url does not begin with '/urlinfo/1/', a 404 is returned with invalid message  (json)
 * url is validated before processing
 * response for a non-safe url looks like this:  {"link": {"status":"not_safe","security_info":"none", "datestamp":"2019-09-29T21:35:29.120Z"}}
 * response for safe url looks like this: {"link": {"status":"ok","security_info":"none", "datestamp":"2019-09-29T22:07:21.260Z"}}
 * 
 * curl http://localhost:3000/urlinfo/1/loremipsum.com:80/ijk?lmn/opq
 * curl http://localhost:3000/urlinfo/1/loremipsum.com:80/opq123
 * 
 * 
 */

var PROXY_TABLE_FILENAME = 'malwaredb.csv',
  REFERSH_INTERVAL       =  300000, //5 minutes
  SERVICE_ENDPOINT       = "/urlinfo/1/",
  http                   = require('http'),
  sprintf                = require('sprintf'),
  q                      = require('q'),
  fs                     = require('fs'),
  path                   = require('path');
  parse                  = require('csv-parse');

// Before doing enaything, lets start by reading data from IO into memory 
readMalwareDB().then(function(db_data){ 
    var cache_data = {};   
    // read each record into memory
    for(record in db_data){
        cache_data[db_data[record].endpoint] = db_data[record].security_info;
        console.log(sprintf("writing  %s:%s to memory", db_data[record].endpoint, db_data[record].security_info));
    }
    // start listening for http requests  
    http.createServer(function(req, res) { 

        var url = req.url;
        if(url.startsWith (SERVICE_ENDPOINT) && uriIsValid(url)) { 
            // check cache to see if there is a match
            var key = url.substr(SERVICE_ENDPOINT.length) // search  key
            console.log(sprintf("Key is  %s  ", key));

            result = cache_data [key]   
            console.log(sprintf("result is  is  %s", result));

            var isItSafe = "not_safe"  // assume its not safe
            if (result === undefined) {  // not match found in cache , safe to visit
                isItSafe = "ok"
            }

            var json_result = sprintf("{\"link\": {\"status\":\"%s\",\"security_info\":\"none\", \"datestamp\":%s}}", 
            isItSafe, JSON.stringify (new Date()) )

            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(json_result); //write a response
        } else {
            res.writeHead(404, {'Content-Type': 'application/json'});
            res.end('"{\"link\": {\"status\":\"invalid\"}}');
        }
    }).listen(80);

    // scheduler to update cache  // runs every 5 minutes REFERSH_INTERVAL = 60000
    var j = setInterval(function() {
        var second_cache_data = {};
        var refreshed_data = readMalwareDB()
        console.log(sprintf("Attempting cache refresh %s", refreshed_data));

        readMalwareDB().then(function(updated_data){ 
            var second_cache_data = {};   
            // read each record into memory
            for(record in updated_data){
                second_cache_data [updated_data[record].endpoint] = updated_data[record].security_info;
                console.log(sprintf("Updated %s and  %s", updated_data[record].endpoint, updated_data[record].security_info));
            }
            // now point to the new memory location
            cache_data = second_cache_data
            console.log(sprintf("Refresh complete"))
        });
    }, REFERSH_INTERVAL);
})
.catch(function(error){
    console.log(sprintf("ERROR %s", error));
});
// function to read table to memory. I would not recommend this in real-life situation. A key/value memory agent will suffice
function readMalwareDB(){
    return q.Promise(function(resolve, reject, notify) {
        var proxyTable = fs.readFileSync(path.join(__dirname, PROXY_TABLE_FILENAME));
        parse(proxyTable, {columns: true}, function(err, data){
            resolve(data);
        });
    });
}
// function to check conformity with /urlinfo/1/{hostname_and_port}/{original_path_and_query_string}
function uriIsValid (fullUrl) {
    try {
        var data = fullUrl.split("/")
        if (data.length < 5)
            throw "Invalid data" 
        //other validations you may want to do.
        return true // all is well with checks
    }
    catch (e) {
        console.log(sprintf("Error %s For %s", e, fullUrl ));
        return false;
    }
}