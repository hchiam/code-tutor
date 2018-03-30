// server.js
// where your node app starts

// imports
const express = require('express');
const ApiAiAssistant = require('actions-on-google').ApiAiAssistant;
const bodyParser = require('body-parser');
const request = require('request');
const Map = require('es6-map');
const prettyjson = require('prettyjson');

// will use Express.js for higher-level code
const app = express();

app.use(bodyParser.json({type: 'application/json'}));

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

// Uncomment the below function to check the authenticity of the API.AI requests.
// See https://docs.api.ai/docs/webhook#section-authentication
/*app.post('/', function(req, res, next) {
  // Instantiate a new API.AI assistant object.
  const assistant = new ApiAiAssistant({request: req, response: res});
  
  // Throw an error if the request is not valid.
  if(assistant.isRequestFromApiAi(process.env.API_AI_SECRET_HEADER_KEY, 
                                  process.env.API_AI_SECRET_HEADER_VALUE)) {
    next();
  } else {
    console.log('Request failed validation - req.headers:', JSON.stringify(req.headers, null, 2));
    
    res.status(400).send('Invalid request');
  }
});*/

// Handle webhook requests
app.post('/', function(req, res, next) {
  // Log the request headers and body, to aid in debugging. You'll be able to view the
  // webhook requests coming from API.AI by clicking the Logs button the sidebar.
  logObject('Request headers: ', req.headers);
  logObject('Request body: ', req.body);
    
  // Instantiate a new API.AI assistant object.
  const assistant = new ApiAiAssistant({request: req, response: res});
  // assistant.tell(JSON.stringify(req.body))
  
  // Declare constants for your action and parameter names
  const ACTION = req.body.result.action; // 'c.to.f'; // The action name from the API.AI intent
  // const PARAMETER = 'number'; // An API.ai parameter name

  // Create functions to handle intents here
  function handleIntent(assistantObject) {
    console.log('Handling action: ' + ACTION);
    // let number = assistantObject.getArgument(PARAMETER);
    
    // let requestURL = "https://www.calcatraz.com/calculator/api?c=1000*" + encodeURIComponent(number);
    // request(requestURL, function(error, response) {
    //   if(error) {
    //     next(error);
    //   } else {
    //     let calculation = response.body;
    //     assistantObject.tell(calculation);
    //   }
    // });
    
    // just get value
    // assistantObject.tell(myCustomCode(ACTION, number));
    
    // extracting my custom code here
    myCustomCode(ACTION, assistantObject);
  }
  
  // Add handler functions to the action router.
  let actionRouter = new Map();
  
  // The ASK_WEATHER_INTENT (askWeather) should map to the getWeather method.
  actionRouter.set(ACTION, handleIntent); // actionRouter.set(ASK_WEATHER_ACTION, getWeather);
  
  // Route requests to the proper handler functions via the action router.
  assistant.handleRequest(actionRouter);
});

// Handle errors.
app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})

// Pretty print objects for logging.
function logObject(message, object, options) {
  console.log(message);
  console.log(prettyjson.render(object, options));
}

// Listen for requests.
let server = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + server.address().port);
});

/*------------------------------------------*/

// my custom code
function myCustomCode(action, assistant) {
  let contextData = assistant.data.contextOut;
  // assistant.data stores the data for use in the rest of the conversation, but you can still ask questions at each step
  if (action === 'test-run') {
    // let i = contextData.input;
    // let o = contextData.output;
    // contextData.result = 'true';
    
    // this one works
    let i = assistant.getArgument('input');
    let o = assistant.getArgument('output');
    // assistant.ask('Expected input: ' + i + '. Expected output: ' + o + '.\ntest multiline --- works on a real device');
    
    // assistant.tell(assistant.buildRichResponse().addBasicCard(assistant.buildBasicCard("card text")));
    // assistant.ask(assistant.buildRichResponse().addBasicCard(assistant.buildBasicCard("card text")));
    
    assistant.ask(assistant.buildRichResponse()
        .addSimpleResponse("Simple response")
        .addBasicCard(assistant.buildBasicCard('L1 L2 L3')
    ));
    
  } else {
    assistant.ask('The action is ' + action);
  }
}
