'use strict';

const functions = require('firebase-functions');
const DialogflowApp = require('actions-on-google').DialogflowApp;

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    console.log('Request headers: ' + JSON.stringify(request.headers));
    console.log('Request body: ' + JSON.stringify(request.body));
    
    // Note: "action-name" !== "intent name"
    // https://dialogflow.com/docs/actions-and-parameters
    // https://dialogflow.com/docs/contexts
    let action = request.body.result.action;
    const parameters = request.body.result.parameters;
    const inputContexts = request.body.result.contexts[0].parameters; // debug without [0].parameters and JSON.stringify to see more info in a JSON
    const requestSource = (request.body.originalRequest) ? request.body.originalRequest.source : undefined;
    
    // create app so you can do app.ask(...);
    const app = new DialogflowApp({
        request: request,
        response: response
    });
    
    const actionHandlers = {
        'default': () => {
            // https://developers.google.com/actions/assistant/responses
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse({
                    speech: "Sorry, I didn't understand that.",
                    displayText: "Sorry. \nI didn't understand that."
                })
            app.ask(googleResponse);
        },
        
        'input.unknown': () => {
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse("I'm still learning. Would you like to suggest something for me to work on to teach you next time?")
                .addSuggestionLink('feedback form', 'https://goo.gl/forms/mn2Xcy0tmNyFQ5y72')
            app.ask(googleResponse);
        },
        
        'suggestion-prefill': () => {
            let suggestion = parameters.suggestion;
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse(`Thanks. I heard this: ${suggestion}`)
                .addSuggestionLink('feedback form', `https://docs.google.com/forms/d/e/1FAIpQLSdi2h9SfAS2EU2AC6PjlqnKPwo5v5i3fQreFN1Vx-fs1MckEA/viewform?usp=pp_url&entry.326955045=${suggestion}`)
            app.ask(googleResponse);
        },
        
        'variable-value': () => {
            let value = parameters.value;
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse({
                    speech: `Here's your code. Let x = "${value}". I've also added a function called "say" that will tell me to say out loud whatever you put in the variable x.`,
                    displayText: "Here's your code:"
                })
                .addBasicCard(
                    app.buildBasicCard(`let x = "**${value}**"; \nsay(x);`)
                )
                .addSuggestions(['run code', 'do something else'])
            app.ask(googleResponse);
        },
        
        'array-size': () => {
            let size = parameters.size;
            if (typeof parseInt(size) !== 'number') {
                size = 2;
            } else if (size < 2) {
                size = 2;
            } else if (size > 10) {
                size = 10;
            }
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse({
                    speech: "Item 1 goes in position 0 in code. \
                        \nWhat would you like to put in position 0 of the array?",
                    displayText: "Item 1 goes in position 0 in code. \
                        \nWhat would you like to put in position 0 of the array?",
                })
                .addBasicCard(
                    app.buildBasicCard(`let x = [${'..., '.repeat(size-1) + '...'}];`)
                )
            app.setContext('array-fill', 1, {
                size: size
            });
            app.ask(googleResponse);
        },
        
        'array-fill': () => {
            let size = inputContexts.size;
            let code = `let x = [${parameters.value + ', ...'.repeat(size-1)}];`;
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse({
                    speech: `Here's your code:`,
                    displayText: "Here's your code:"
                })
                .addBasicCard(
                    app.buildBasicCard(code)
                )
                .addSuggestions(['run code', 'do something else'])
            app.ask(googleResponse);
        },
    };
    
    if (!actionHandlers[action]) {
        action = 'default';
    }
    
    actionHandlers[action]();
    
});
