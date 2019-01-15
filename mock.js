/**
 * Mock module to test mail templates
 * Module is required in development/test mode
 * Test can be done by sending http post to the local server (port 45321)
 * Post body must be application/json and variables "mailTemplate" and "mailVariables" set
 */

const http = require('http');
const port = 45321;
let senderFn;

//mock classes for testing
class _task{
    constructor(){
        this.variables = new _variables();
    }
}
class _variables{
    constructor(){
        this.mailTemplate = '';
        this.mailVariables = '';
        this.mailOptions = '';
    }

    get(name){
        return this[name];
    }

    set(name, value){
        this[name] = value;
    }
}
class _taskService{
    constructor(){}
    async complete(t, vars){
        console.log(t);
        console.log(vars);
    }
    async handleFailure(t, err){
        console.error(t);
        console.error(err);
    }
}

function start(main){
    senderFn = main;
    const server = http.createServer(requestHandler);
    server.listen(port, (err) => {
        if (err) {
            return console.error('Error: ', err)
        }

        console.log(`mock server is listening on ${port}`)
    });
}

const requestHandler = (request, response) => {
    const { headers, method, url } = request;
    if (request.method === 'POST') {
        let body = '';
        request.on('data', chunk => {
            body += chunk.toString();
        });
        request.on('end', () => {
            let content = JSON.parse(body);
            console.log(content);

            if(content){
                let t = new _task();

                t.variables.set('mailTemplate', content.mailTemplate);
                t.variables.set('mailVariables', JSON.stringify(content.mailVariables));
                t.variables.set('mailOptions', JSON.stringify((content.mailOptions || {})));
                t.variables.set('attachments', JSON.stringify((content.attachments || [])));

                let service = new _taskService();
                senderFn({task: t, taskService: service});
            }
            response.end('ok');
        });
    }
};

module.exports = { start };