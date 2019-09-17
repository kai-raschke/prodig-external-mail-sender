const fs = require('fs'), path = require('path');
const { log } = require('@kai-raschke/prodig-external-deps')();
const mjml2html = require('mjml'), //.default;
    handlebars = require('handlebars');

function render (view, locals) {
    return new Promise((res, rej) => {
        log.debug(`Try view ${view}`);
        let emailPath = path.join(__dirname, 'emails', view.split('/')[0], 'html.handlebars.mjml');
        let pMjml = path.join(__dirname, 'emails', `${view}.handlebars.mjml`);
        let pHandlebars = path.join(__dirname, 'emails', `${view}.handlebars`);

        log.debug(`Try ${pMjml} and ${pHandlebars}`);
        log.debug(`Mjml format ${(fs.existsSync(pMjml) ? `exists, filePath: ${emailPath}` : 'does not exist')}`);

        let templateFile, mode = "none";
        if(fs.existsSync(pMjml)){
            templateFile = pMjml;
            mode = "mjml";
        }
        else if(fs.existsSync(pHandlebars)){
            templateFile = pHandlebars;
            mode = "handlebars";
        }

        if(mode === "none"){
            res('');
        }
        else{
            fs.readFile(templateFile, async function read(err, data) {
                if (err) {
                    rej (err);
                }

                let template;
                //Render mjml if available
                if(mode === "mjml"){
                    let htmlOutput = mjml2html(data.toString(), {
                        minify: true,
                        keepComments: false,
                        filePath: emailPath
                    });

                    template = handlebars.compile(htmlOutput.html);
                }
                else{
                    template = handlebars.compile(data.toString());
                }

                log.debug(`Had ${view} got ${template.length} characters`);
                const result = template(locals);
                res(result);
            });
        }
    });
}

module.exports = { render };