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
                .addSimpleResponse("I'm always learning. Would you like to suggest something for me to work on to teach you next time?")
                .addSuggestionLink('feedback form', 'https://goo.gl/forms/mn2Xcy0tmNyFQ5y72')
            app.ask(googleResponse);
        },
        
        'suggestion-prefill': () => {
            let suggestion = parameters.suggestion;
            let hasScreen = app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT);
            let googleResponse;
            if (hasScreen) {
                googleResponse = app.buildRichResponse()
                    .addSimpleResponse(`Thanks. Right now Google's Dialogflow isn't able to let me open a link for you hands-free. But here's a link to a feedback form that I've pre-filled for you with what I just heard: ${suggestion}`)
                    .addSuggestionLink('feedback form', `https://docs.google.com/forms/d/e/1FAIpQLSdi2h9SfAS2EU2AC6PjlqnKPwo5v5i3fQreFN1Vx-fs1MckEA/viewform?usp=pp_url&entry.326955045=${suggestion}`)
                app.ask(googleResponse);
            } else {
                googleResponse = app.buildRichResponse()
                    .addSimpleResponse(`Sorry, right now Google's Dialogflow isn't able to let me open a link for you hands-free. If you go on a device with a screen, you'll see a link to a feedback form. Code Tutor signing out.`)
                // exit by using tell instead of say
                app.tell(googleResponse);
            }
        },
        
        'variable-value': () => {
            let value = parameters.value;
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse({
                    speech: `Here's your code. Let x = "${value}". I've also added a function called "say" that will tell me to say out loud what you've put in the variable x.`,
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
            
            let code = `let x = [${'..., '.repeat(size-1) + '...'}];`;
            
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse({
                    speech: "Item number 1 goes to position 0 in code. \
                        \nWhat should go to position 0?",
                    displayText: "Item number 1 goes to position 0 in code. \
                        \nWhat should go to position 0 of the array?",
                })
                .addBasicCard(
                    app.buildBasicCard(code)
                )
            
            app.setContext('array-fill', 1, {
                code: code,
                size: size,
                i: 0,
                array: [null]
            });
            
            app.ask(googleResponse);
        },
        
        'array-fill': () => {
            let code = inputContexts.code;
            let size = inputContexts.size;
            let i = inputContexts.i;
            let array = inputContexts.array;
            let value = parameters.value;
            let googleResponse;
            let moreArrayIndicesToFill = i < size-1;
            
            array[i] = value;
            code += `\nx[${i}] = ${value};`;
            
            if (moreArrayIndicesToFill) {
                googleResponse = app.buildRichResponse()
                    .addSimpleResponse(`Item number ${i+2} goes to position ${i+1} in code.\nWhat should go to position ${i+1} of the array?`)
                    .addBasicCard(
                        app.buildBasicCard(code)
                    )
                // repeat to fill remainder of array
                app.setContext('array-fill', 1, {
                    code: code,
                    size: size,
                    i: i+1,
                    array: array
                });
            } else {
                googleResponse = app.buildRichResponse()
                    .addSimpleResponse({
                        speech: `Here's your code: ${code}. I've also added a function called "say" that will tell me to say out loud what you've put in the array x.`,
                        displayText: `Here's your code:`
                    })
                    .addBasicCard(
                        app.buildBasicCard(code + `\nsay(x);`)
                    )
                    .addSuggestions(['run code', 'do something else']);
                app.setContext('array-run', 1, {
                    array: array
                });
            }
            app.ask(googleResponse);
        },
        
        'array-run': () => {
            let array = inputContexts.array;
            app.ask(`${JSON.stringify(array)} debug test`);
        },
    };
    
    if (!actionHandlers[action]) {
        action = 'default';
    }
    
    actionHandlers[action]();
    
});
