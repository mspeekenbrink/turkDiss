/*
 * Requires:
 *     psiturk.js
 *     utils.js
 */

// Initalize psiturk object
var psiTurk = PsiTurk();

// All pages to be loaded
var pages = [
	"instruct.html",
	"test.html",
	"postquestionnaire.html"
];

psiTurk.preloadPages(pages);






// Task object to keep track of the current phase
var currentview;


/********************
* HTML manipulation
*
* All HTML files in the templates directory are requested 
* from the server when the PsiTurk object is created above. We
* need code to get those pages from the PsiTurk object and 
* insert them into the document.
*
********************/


/*************************
* INSTRUCTIONS         
*************************/

var Instructions = function(pages) {
	var currentscreen = 0,
	    timestamp;
	    instruction_pages = pages; 
	
	var next = function() {
		psiTurk.showPage(instruction_pages[currentscreen]);
		$('.continue').click(function() {
			buttonPress();
		});
		
		currentscreen = currentscreen + 1;

		// Record the time that an instructions page is presented
		timestamp = new Date().getTime();
	};

	var buttonPress = function() {

		// Record the response time
		var rt = (new Date().getTime()) - timestamp;
		psiTurk.recordTrialData(["INSTRUCTIONS", currentscreen, rt]);

		if (currentscreen == instruction_pages.length) {
			finish();
		} else {
			next();
		}

	};

	var finish = function() {
		// Record that the user has finished the instructions and 
		// moved on to the experiment. This changes their status code
		// in the database.
		psiTurk.finishInstructions();

		// Move on to the experiment 
		currentview = new TestPhase();
	};

	next();
};



/********************
* BANDIT TEST       *
********************/

var TestPhase = function() {
    // Globals
    var cardSelected = false;
    var data = {};
    var trial = 1;
    var maxTrial = 5;
    var condition= psiTurk.taskdata.get('condition');

    // Structure of data:
    //  data ==== trialX ==== 'chosen_card'
    //                   ==== 'chosen_value'
    //                   ==== 'max_value'
    //                   ==== 'trialNumber'
    //                   ==== 'condition'
    //                   ==== 'cardX' ==== 'R'
    //                                ==== 'mu'

    // Normal random number generator; Box-Muller transform (ignoring second random value returned 'y')
    var rnd = function rnd(mean, stDev) {
        var x = 0, y = 0, rds, c;

        do {
        x = Math.random()*2-1;
        y = Math.random()*2-1;
        rds = x*x + y*y;
        }
        while (rds == 0 || rds > 1)

        c = Math.sqrt(-2*Math.log(rds)/rds);

        return x * c * stDev + mean;
    };

    // Payout function:

    // R[j](t) = mu[j](t) + epsilon[j](t)
    // mu[j](t) = mu[j](t-1) - 6 * delta1[j](t-1) + 2 * delta2[j](t-1) + psi[j](t)

    // Where:
    // * R[j](t) is the reward of deck j on trial t
    // * epsilon[j](t) is a random Normal variate with mean 0 and standard deviation sigma[e]
    // * mu[j](t) is the mean reward of deck j on trial t
    // * delta1[j](t-1) is an indicator function with value 1 if deck j was chosen on trial t-1 and 0 otherwise
    // * delta2[j](t-1) is an indicator function with value 1 if deck j was not chosen on trial t-1 and 0 otherwise
    // * psi[j](t) is a random Normal variate with mean 0 and standard deviation sigma[p]
    // calcR argument is a string: 'cardX'
    var calcR = function(card) {
        // Indicator function assignment
            // Will be NaN on first trial as no prior trials to compare to... Need to compare IDs in case of duplicate numbers
            // Comparing int of html ID tag against string of data element, so need to strip string and turn to int
            if (data[trial - 1]['chosen_card'] == data[trial - 1][parseInt(card.replace('card',''))]) {
                var delta1 = 1;
                var delta2 = 0;
            }
            else {
                var delta1 = 0;
                var delta2 = 1;
            }
        //data[trial][card]['mu'] = data[trial - 1][card]['mu'] - (6 * data[trial - 1][card]['delta1']) + (2 * data[trial - 1][card]['delta2']) + rnd(1, 1);
        mu = data[trial - 1][card]['mu'] - (6 * delta1) + (2 * delta2) + rnd(1, 1);
        //data[trial][card]['R'] = data[trial][card]['mu'] + rnd(1, 1);
        R = mu + rnd(1, 1);
        return {R: R,
                mu: mu
        };
    };

        // Function to generate numbers, stored in data
//      var genNumbers = function() {
//        data[trial] = {};
//        data[trial]['card1'] = Math.floor(Math.random()*51);
//        data[trial]['card2'] = Math.floor(Math.random()*51);
//        data[trial]['card3'] = Math.floor(Math.random()*51);
//        data[trial]['card4'] = Math.floor(Math.random()*51);
//        return data[trial];
//      };

    //  Function to generate numbers, stored in data. Have to initialise all levels of data. New data[trial] made each trial
    var genNumbers = function() {
        data[trial] = {};
        for (var i = 1; i <= 4; i++) {
            data[trial]['card' + i] = {};
            var values = calcR('card' + i);
            data[trial]['card' + i]['R'] = values.R;
            data[trial]['card' + i]['mu'] = values.mu;
        }
        return data[trial];
    };

    // Function to set cards to 0; to prevent cheating
    var setBlanks = function() {
        for (var i = 1; i <= 4; i++) {
            $('#' + i).html('0');
        }
    };

    // Function to set cards
    var setCards = function(values) {
        for (var i = 1; i <= 4; i++) {
            $('#' + i).html(values['card' + i]['R']);
        }
    };

    var next = function() {

        // When a card is selected
        $('._card').click(function () {
            // Get value of selection and refresh
            if (cardSelected == false) {
                cardSelected = true;

                // Initialise trial - 1 for the first trial to use. Must initialise all levels
                if (trial == 1) {
                    data[trial - 1] = {};
                    // Arbitrary, set it to initial positions
                    for (var i = 1; i <= 4; i++) {
                        data[trial - 1]['card' + i] = {};
                        data[trial - 1]['card' + i]['mu'] = 100;
                        data[trial - 1]['card' + i]['R'] = 100;
                    }
                }

                data[trial] = genNumbers();

                // REMOVE BEFORE GOING LIVE
                // For testing- iterate through data and print to console OLD DATA
                for (var x in data[trial]) {
                    console.log(x, data[trial][x])
                }
                console.log(trial);

                // Set cards
                setCards(data[trial]);

                // Show card picked
                var card = $(this).find('p', 'first');
                card.slideDown();

                // Record meta-information
                data[trial]['chosen_card'] = parseInt(card.attr('id'));
                data[trial]['chosen_value'] = parseInt($('#' + data[trial]['chosen_card']).html());
                data[trial]['max_value'] = Math.max(data[trial]['card1']['R'], data[trial]['card2']['R'], data[trial]['card3']['R'], data[trial]['card4']['R']);
                data[trial]['trialNumber'] = trial;
                data[trial]['condition'] = condition;

                // Note: timings are not additive: all absolute and begin at 0
                // Condition 0: unnecessary to code, (show card picked)
                // Condition 1: (show card picked) and max alternative, wait hiddenTime
                if (condition == 1) {
                    setTimeout(function() {
                        $('ul.list-unstyled li').html('The maximum from this trial was ' + data[trial]['max_value']).slideDown();
                    }, 1000);
                }
                // Condition 2: (show card picked) followed by all remaining, hidden cards. Wait hiddenTime
                else if (condition == 2) {
                    setTimeout(function() {
                        $('._card :hidden').slideDown();
                    }, 1000);
                }

                // Save data to psiTurk object
                trialSet = [];
                for (var x in data[trial]) {
                        trialSet.push(data[trial][x]);
                    }
                //No idea if works, you get the idea; iterate through: cards, then R and mu. Now debug.
                for (var y = 1; y <= 4; y++) {
                    for (var z in data[trial]['card' + y][z])
                        trialSet.push(data[trial]['card' + y][z]);
                    }
                psiTurk.recordTrialData(trialSet);

                // Forgone code
                // Add delay to trials
                setTimeout(function () {

                    // Re-hide all new cards and messages
                    $('._card p').hide();
                    $('ul.list-unstyled li').hide();

                    // Task finish condition
                    if (trial == maxTrial) {
                        psiTurk.saveData();
                        finish();
                    }

                    // Update trial number
                    trial++;

                    // Create and assign new card values, record prior trial for dynamic element
                    //console.log(data);
                    setBlanks();

                    cardSelected = false;

                }, 3000);
            }
        });
    };

    var finish = function() {
		currentview = new Questionnaire();
	};

    // Load the test.html snippet into the body of the page
	psiTurk.showPage('test.html');

    // Start the test
	next();

};


/****************
* Questionnaire *
****************/

var Questionnaire = function() {

	var error_message = "<h1>Oops!</h1><p>Something went wrong submitting your HIT. This might happen if you lose your internet connection. Press the button to resubmit.</p><button id='resubmit'>Resubmit</button>";

	record_responses = function() {

		psiTurk.recordTrialData(['postquestionnaire', 'submit']);

		$('textarea').each( function(i, val) {
			psiTurk.recordUnstructuredData(this.id, this.value);
		});
		$('select').each( function(i, val) {
			psiTurk.recordUnstructuredData(this.id, this.value);		
		});

	};
	
	finish = function() {
		debriefing();
	};
	
	prompt_resubmit = function() {
		replaceBody(error_message);
		$("#resubmit").click(resubmit);
	};

	resubmit = function() {
		replaceBody("<h1>Trying to resubmit...</h1>");
		reprompt = setTimeout(prompt_resubmit, 10000);
		
		psiTurk.saveData({
			success: function() {
				clearInterval(reprompt); 
				finish();
			}, 
			error: prompt_resubmit}
		);
	};

	// Load the questionnaire snippet 
	psiTurk.showPage('postquestionnaire.html');
	psiTurk.recordTrialData(['postquestionnaire', 'begin']);
	
	$("#continue").click(function () {
		record_responses();
		psiTurk.teardownTask();
    	psiTurk.saveData({success: finish, error: prompt_resubmit});
	});
	
};


var debriefing = function() { window.location="/debrief?uniqueId=" + psiTurk.taskdata.id; };


/*******************
 * Run Task
 ******************/
$(window).load( function(){
    currentview = new Instructions([
		"instruct.html"
	]);
});

// vi: noexpandtab tabstop=4 shiftwidth=4
