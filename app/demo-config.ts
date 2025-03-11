import { DemoConfig, ParameterLocation } from "@/lib/types";
import axios from "axios";
import { UltravoxSession, UltravoxSessionStatus } from 'ultravox-client';

// API Base URL
const API_BASE_URL = "https://api-dev.physiotattva247.com";

// Custom Event Name for Fetch Slots
export const FETCH_SLOTS_EVENT = 'fetchSlotsEvent';

// Store consultation data for UI display
let consultationData = {
  symptoms: [],
  appointment: {},
  assessmentStatus: "Not started"
};

// Current user email for stages
let currentUserEmail = "";

// Current appointments for stages
let currentAppointments = [];

// Function to dispatch event with slot data
const dispatchFetchSlotsEvent = (slotData) => {
  try {
    console.log("Attempting to dispatch fetch slots event");
    const event = new CustomEvent(FETCH_SLOTS_EVENT, {
      detail: { slotData }
    });
    
    console.log("Dispatching fetch slots event with data:", slotData);
    document.dispatchEvent(event);
  } catch (error) {
    console.error("Error dispatching fetch slots event:", error);
  }
};

// Fetch existing appointments
async function fetchAppointments(userEmail) {
  try {
    const response = await axios.get(
      `https://test-cadambams-phytat.p7devs.com/appointment/?phone_number=9873219957`
    );
    console.log("Appointments API response:", JSON.stringify(response.data, null, 2));
    return response.data.upcoming_appointments || [];
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return [];
  }
}

// Format date-time
function formatDateTime() {
  return new Date().toISOString();
}

// Generate system prompt based on stage
function getSystemPrompt(
  userEmail = "",
  appointments = [],
  currentStage = "initial"
) {
  let appointmentsText = "";
  if (appointments && appointments.length > 0) {
    appointmentsText = `
Important: Patient has existing appointment(s):
${appointments
  .map((appt) => {
    return `- ${appt.doctor_name} appointment on ${appt.formatted_startdate} at ${appt.time}
  Type: ${appt.consultation_type}
  Status: ${appt.appointment_stage}`;
  })
  .join("\n")}`;
  } else {
    appointmentsText = "No existing appointments found.";
  }

  const baseContext = `
Current Date and Time: ${formatDateTime()}
Current User: ${userEmail || "Anonymous"}
${appointmentsText}`;

const agentPrompts = {
  initial: `
# Role: You are Dr. Riya, an exceptional physiotherapist working for Physiotattva You possess in-depth knowledge and skills in physiotherapy.
# Rule: Strictly only ask one question at a time

Stage 1: Initial Greeting & Routing (Dr. Riya)

FIRST MESSAGE MUST ALWAYS BE EXACTLY:
"Hi, this is Dr. Riya from Physiotattva. How can I assist you today?"

IMPORTANT TOOL INSTRUCTIONS - READ CAREFULLY:
- You have a special tool called changeStage
- NEVER write out "changeStage" in your response text
- NEVER say phrases like "I'm going to route you" or "I'll transfer you"
- When you identify a topic from the rules below, SILENTLY use the tool
- After identifying the topic, simply respond naturally to the user
- Never ask two questions together - ask only one question at a time

Routing Logic:
1. If user mentions appointment-related terms (booking, schedule, timing, slot), SILENTLY use the changeStage tool to route to 'booking'
2. If user describes symptoms (pain, discomfort, ache), SILENTLY use the changeStage tool to route to 'symptom'
3. If user asks about existing appointments, SILENTLY use the changeStage tool to route to 'appointmentLookup'
4. If user asks about services, provide information from context

${baseContext}`,

  symptom: `
# Role: You are Dr. Riya, an exceptional physiotherapist working for Physiotattva You possess in-depth knowledge and skills in physiotherapy.
# Rule: Strictly only ask one question at a time

Stage 2: Symptom Checker Bot

FIRST MESSAGE MUST ALWAYS BE EXACTLY:
"I understand you have some discomfort. Can you describe where you feel the pain?"

IMPORTANT TOOL INSTRUCTIONS - READ CAREFULLY:
- You have tools called updateConsultation and changeStage
- NEVER write out the tool names in your response text
- NEVER tell the user you're recording symptoms or changing stages
- Use these tools SILENTLY in the background
- ALWAYS use updateConsultation after EACH symptom is identified with ALL details you know about it

Follow-up Questions (Strictly only ask one question at a time):
1. "How long have you had this pain?"
2. "On a scale of 1 to 10, how severe is it?"
3. "Is the pain constant or does it come and go?"
4. "Does it worsen with movement?"

AFTER COLLECTING EACH PIECE OF INFORMATION:
- IMMEDIATELY use updateConsultation to record the symptom data with all details
- Use this JSON format for symptoms:
{
  "consultationData": {
    "symptoms": [{
      "symptom": "Lower back pain",
      "location": "Lower back, right side",
      "severity": "7/10",
      "duration": "2 weeks",
      "pattern": "Constant with occasional sharp spikes",
      "movementImpact": "Worse when bending forward"
    }],
    "assessmentStatus": "In Progress"
  }
}

Decision:
- If symptoms match physiotherapy condition → SILENTLY use the changeStage tool to route to 'booking'
- If symptoms need urgent care → Recommend immediate medical attention

${baseContext}`,

  booking: `
# Role: You are Dr. Riya, an exceptional physiotherapist working for Physiotattva You possess in-depth knowledge and skills in physiotherapy.
# Rule: Strictly only ask one question at a time

Stage 3: Appointment Booking

FIRST MESSAGE MUST ALWAYS BE EXACTLY:
"Would you like an in-person or online consultation?"

IMPORTANT TOOL INSTRUCTIONS - READ CAREFULLY:
- You have tools called updateConsultation, fetchSlots, bookAppointment, and changeStage
- NEVER write out the tool names in your response text
- NEVER tell the user you're using tools to fetch slots or book appointments
- Use these tools SILENTLY in the background

STRICT BOOKING WORKFLOW - FOLLOW THIS EXACTLY AND ASK ONLY ONE QUESTION AT A TIME:

Case 1: In-Person Appointment (₹499)

1. If user selects "in-person", ask ONLY: "We have centers in Bangalore and Hyderabad. Which city do you prefer?"
 Store city information using updateConsultation.

2. Based on city response, ask ONLY: "Please choose a center from the available locations."
 For Bangalore, mention: "Indiranagar and Whitefield"
 For Hyderabad, mention: "Banjara Hills and Madhapur"
 Store center information using updateConsultation.

3. After center selection, ask ONLY: "What day of this week or next week would you prefer? (Available Monday to Saturday)"
 Store week preference using updateConsultation.

4. After day selection, SILENTLY use fetchSlots with:
 - week_selection: User's choice
 - selected_day: User's choice (convert to "mon", "tue", etc.)
 - consultation_type: "inperson"
 - campus_id: Selected center (the first letter should be capital for example - "Indiranagar")
 - speciality_id: "Physiotherapy"
 - user_id: 1

5. When you receive the fetchSlots response, list EVERY available slot:
 "Here are the available time slots for [day] at [center]:
 - 9:00 AM to 10:00 AM
 - 10:00 AM to 11:00 AM
 - [continue listing ALL slots marked as 'available']"

 After listing all available slots, ask: "Which time slot works for you?"
 Store selected slot using updateConsultation.

6. After slot selection, ask ONLY: "May I know your full name, please?"
 Store name using updateConsultation.

7. After getting name, ask ONLY: "Could you share your mobile number?"
 IMPORTANT: Use updateConsultation to store the mobile number in this exact format:
 {
   "consultationData": {
     "appointment": {
       "mobileNumber": "EXACT_NUMBER_USER_PROVIDED"
     }
   }
 }

8. After getting mobile, say: "The consultation fee is ₹499. Proceeding with booking..."
 Then SILENTLY use bookAppointment with:
 - week_selection: User's selected week
 - selected_day: User's selected day
 - start_time: User's selected time slot
 - consultation_type: "In-person"
 - campus_id: Selected center
 - speciality_id: "Physiotherapy"
 - user_id: 1
 - patient_name: User's provided name
 - mobile_number: User provided number
 - payment_mode: "pay now"

9. After successful booking, read out the booking details including:
  - The appointment date and time
  - The center location
  - The doctor's name if available
  - The consultation type (In-person)
  - The booking ID if available
  - The payment link

10. End with EXACTLY: "Your appointment is confirmed. You'll receive details shortly. Anything else I can help with?"

Case 2: Online Appointment (₹99)

1. If user selects "online", ask ONLY: "What day of this week or next week would you prefer? (Available Monday to Saturday)"
 Store this information using updateConsultation.

2. After user selects day, SILENTLY use fetchSlots with these parameters:
 - week_selection: Determine if "this week" or "next week" based on day
 - selected_day: User's choice (convert to "mon", "tue", etc.)
 - consultation_type: "Online"
 - campus_id: "Indiranagar"
 - speciality_id: "Physiotherapy"
 - user_id: 1

3. When you receive the fetchSlots response, list EVERY available slot:
 "Here are the available time slots for [day]:
 - 9:00 AM to 10:00 AM
 - 10:00 AM to 11:00 AM
 - [continue listing ALL slots marked as 'available']"

 After listing all available slots, ask: "Which time slot works for you?"
 Store selected slot using updateConsultation.

4. After slot selection, ask ONLY: "May I know your full name, please?"
 Store name using updateConsultation.

5. After getting name, ask ONLY: "Could you share your mobile number?"
 IMPORTANT: Use updateConsultation to store the mobile number in this exact format:
 {
   "consultationData": {
     "appointment": {
       "mobileNumber": "EXACT_NUMBER_USER_PROVIDED"
     }
   }
 }

6. After getting mobile, say: "The consultation fee is ₹99. Proceeding with booking..."
 Then SILENTLY use bookAppointment with:
 - week_selection: Determined from day selection
 - selected_day: User's selected day (mon, tue, etc.)
 - start_time: User's selected time slot
 - consultation_type: "Online"
 - campus_id: "Indiranagar"
 - speciality_id: "Physiotherapy"
 - user_id: 1
 - patient_name: User's provided name
 - mobile_number: user provided number
 - payment_mode: "pay now"

7. After successful booking, read out the booking details including:
 - The appointment date and time
 - The doctor's name if available
 - The consultation type (Online)
 - The booking ID if available
 - The payment link
 
8. End with EXACTLY: "Your appointment is confirmed. You'll receive details shortly. Anything else I can help with?"

IMPORTANT NOTES:
- DO NOT skip any steps in the workflow
- When the user selects a time slot, always use EXACTLY that time slot for booking
- ASK ONLY ONE QUESTION AT A TIME
- Store all user selections using updateConsultation before moving to the next step
- Always include payment link in your response after booking
- VERY IMPORTANT: Always use the mobile number 9632680280 for bookings regardless of what the user provides

${baseContext}`,

  appointmentLookup: `
# Role: You are Dr. Riya, an exceptional physiotherapist working for Physiotattva You possess in-depth knowledge and skills in physiotherapy.
# Rule: Strictly only ask one question at a time

Stage 4: Appointment Lookup

FIRST MESSAGE MUST ALWAYS BE EXACTLY:
"Let me check your upcoming appointments."

WORKFLOW:
1. Present appointment details from context
2. Offer rescheduling or cancellation options
3. Process any changes requested

${baseContext}`
};

// Return the specific prompt based on stage
return agentPrompts[currentStage] || agentPrompts.initial;
}

// Implementation for handling the "new-stage" response
const handleChangeStage = async (newStage) => {
  console.log(`Changing to stage: ${newStage}`);
  
  // Get the system prompt for the new stage
  const systemPrompt = getSystemPrompt(currentUserEmail, currentAppointments, newStage);
  
  // Return the new stage info
  return {
    type: "new-stage",
    systemPrompt: systemPrompt,
    voice: "Jessica",
    temperature: 0.3,
    languageHint: "en"
  };
};

// Initialize Ultravox Session
let uvSession = null;

// Function to initialize the session
export const initializeSession = (joinUrl) => {
  try {
    console.log("Initializing Ultravox session with joinUrl:", joinUrl);
    
    // Create new session instance
    uvSession = new UltravoxSession();
    
    // Reset consultation data
    consultationData = {
      symptoms: [],
      appointment: {},
      assessmentStatus: "Not started"
    };
    
    // Add event listeners
    uvSession.addEventListener('status', (event) => {
      console.log('Session status:', uvSession?.status);
    });

    uvSession.addEventListener('transcripts', (event) => {
      console.log('New transcript event received');
      
      // Process transcript events for updating consultation data
      if (uvSession?.transcripts && uvSession.transcripts.length > 0) {
        const latestTranscript = uvSession.transcripts[uvSession.transcripts.length - 1];
        if (latestTranscript && latestTranscript.text) {
          // Check if the transcript contains any slot information
          updateConsultationDataFromTranscript(latestTranscript.text);
        }
      }
    });

    // Intercept tool results to modify model inputs
    uvSession.addEventListener('toolresults', (event) => {
      console.log("Received tool results event:", event.detail?.toolName);
      
      if (event.detail && (event.detail.toolName === "fetchslot" || event.detail.toolName === "fetchSlots")) {
        try {
          console.log("Received fetchSlot tool result:", event.detail.text);
          
          // Parse the result
          const resultData = JSON.parse(event.detail.text);
          
          // Force the slot information into the next model input
          const formattedSlots = formatAvailableSlotsMessage(resultData);
          if (formattedSlots) {
            // Prepend the slot information to the transcript for the model to see
            prependToTranscript(formattedSlots);
          }
          
          // Store the slot data in consultation data
          processSlotData(resultData);
          
          // Dispatch event for UI to show the popup with slot selection
          console.log("About to dispatch fetch slots event");
          dispatchFetchSlotsEvent(resultData);
        } catch (error) {
          console.error("Error processing fetchSlots result:", error);
        }
      } else if (event.detail && event.detail.toolName === "bookappointment") {
        try {
          console.log("Received bookAppointment tool result:", event.detail.text);
          
          // Parse the result
          const resultData = JSON.parse(event.detail.text);
          
          // Check input to see if we need to fix phone number
          if (event.detail.input && typeof event.detail.input === 'string') {
            try {
              const inputData = JSON.parse(event.detail.input);
              // Log what phone number is being used
              console.log("Booking appointment with phone number:", inputData.mobile_number);
              
              // Store phone number in consultation data
              if (inputData.mobile_number) {
                consultationData.appointment.mobileNumber = inputData.mobile_number;
              }
            } catch (error) {
              console.error("Error parsing booking input:", error);
            }
          }
          
          // Update consultation data with booking details
          if (resultData && resultData.success && resultData.appointmentInfo) {
            const appointmentInfo = resultData.appointmentInfo;
            const payment = resultData.payment;
            
            consultationData.appointment = {
              ...consultationData.appointment,
              doctor: appointmentInfo.appointed_doctor,
              status: "Confirmed",
              date: appointmentInfo.calculated_date,
              time: appointmentInfo.startDateTime.split(' ')[1],
              consultationType: appointmentInfo.consultation_type,
              paymentLink: payment?.short_url || '',
              bookingId: payment?.reference_id || '',
              fullDetails: {
                ...appointmentInfo,
                payment: payment
              }
            };
            
            // Log the updated consultation data
            console.log("Updated consultation data with booking:", consultationData);
            
// Dispatch an event to notify the UI of the booking
try {
  const bookingEvent = new CustomEvent('appointmentBooked', {
    detail: {
      appointment: consultationData.appointment
    }
  });
  document.dispatchEvent(bookingEvent);
  console.log("Dispatched appointment booked event");
} catch (eventError) {
  console.error("Error dispatching booking event:", eventError);
}
}
} catch (error) {
console.error("Error processing bookAppointment result:", error);
}
} else if (event.detail && event.detail.toolName === "updateConsultation") {
try {
console.log("Received updateConsultation tool result:", event.detail.text);
console.log("Input parameters:", event.detail.input);

// Try to extract phone number if present
if (event.detail.input && typeof event.detail.input === 'string') {
try {
  const trimmedInput = event.detail.input.trim();
  if (trimmedInput.startsWith('{') && trimmedInput.endsWith('}')) {
    const inputData = JSON.parse(trimmedInput);
    
    // Check for appointment data with phone number
    if (inputData.consultationData && 
        inputData.consultationData.appointment && 
        inputData.consultationData.appointment.mobileNumber) {
      
      consultationData.appointment.mobileNumber = 
        inputData.consultationData.appointment.mobileNumber;
      
      console.log("Updated phone number from updateConsultation:", 
        consultationData.appointment.mobileNumber);
    }
  }
} catch (jsonError) {
  console.log("Error parsing updateConsultation input:", jsonError);
}
}

// Try to extract symptom data from the input parameters using safer parsing
if (event.detail.input && typeof event.detail.input === 'string') {
try {
  // First, validate that the input looks like JSON before parsing
  const trimmedInput = event.detail.input.trim();
  if (trimmedInput.startsWith('{') && trimmedInput.endsWith('}')) {
    const inputData = JSON.parse(trimmedInput);
    
    // Check if the input contains symptom data
    if (inputData && inputData.consultationData && inputData.consultationData.symptoms) {
      const symptomsData = inputData.consultationData.symptoms;
      
      // Process symptoms
      if (Array.isArray(symptomsData)) {
        processSymptomData(symptomsData);
      } else if (typeof symptomsData === 'object' && symptomsData !== null) {
        processSymptomData([symptomsData]);
      } else if (typeof symptomsData === 'string') {
        // Handle case where symptom is a string
        processSymptomData([{ symptom: symptomsData }]);
      }
    }
  } else {
    // If it doesn't look like JSON, try to extract symptom info via regex
    extractSymptomsFromText(event.detail.input);
  }
} catch (jsonError) {
  console.log("Error parsing updateConsultation input:", jsonError);
  // Attempt to extract information using regex as fallback
  extractSymptomsFromText(event.detail.input);
}
}
} catch (error) {
console.error("Error processing updateConsultation result:", error);
}
}
});

// Register the changeStage handler for 'new-stage' responses
uvSession.registerNewStageHandler(handleChangeStage);

// Join the call
console.log("Joining call with URL:", joinUrl);
uvSession.joinCall(joinUrl);
console.log('Call joined successfully');

return uvSession;
} catch (error) {
console.error('Error in initializeSession:', error);
return null;
}
};

// Add a new helper function to extract symptoms from text using regex
const extractSymptomsFromText = (text) => {
try {
if (!text || typeof text !== 'string') return;

console.log("Attempting to extract symptoms from text:", text);

// Look for patterns that might indicate symptoms
const symptomPatterns = [
/symptom:\s*"([^"]+)"/i,
/symptom:\s*'([^']+)'/i,
/symptom[:\s]+([^.,"\{\}\[\]]+)/i,
/"symptom"[:\s]+"([^"]+)"/i,
/'symptom'[:\s]+'([^']+)'/i
];

for (const pattern of symptomPatterns) {
const match = text.match(pattern);
if (match && match[1]) {
const symptomText = match[1].trim();

// Skip if empty
if (!symptomText) continue;

// Check if this symptom already exists
const existingSymptoms = consultationData.symptoms.map(s => 
(s.symptom || '').toLowerCase()
);

if (!existingSymptoms.includes(symptomText.toLowerCase())) {
// Look for other attributes
let severity = "Not specified";
let duration = "Not specified";
let pattern = "Not specified";
let location = "Not specified";
let movementImpact = "Not specified";

// Try to extract severity
const severityMatch = text.match(/severity[:\s]+"([^"]+)"/i) || 
                  text.match(/severity[:\s]+'([^']+)'/i) ||
                  text.match(/severity[:\s]+([^.,"\{\}\[\]]+)/i);
if (severityMatch && severityMatch[1]) {
severity = severityMatch[1].trim();
}

// Try to extract duration
const durationMatch = text.match(/duration[:\s]+"([^"]+)"/i) || 
                  text.match(/duration[:\s]+'([^']+)'/i) ||
                  text.match(/duration[:\s]+([^.,"\{\}\[\]]+)/i);
if (durationMatch && durationMatch[1]) {
duration = durationMatch[1].trim();
}

// Try to extract location
const locationMatch = text.match(/location[:\s]+"([^"]+)"/i) || 
                  text.match(/location[:\s]+'([^']+)'/i) ||
                  text.match(/location[:\s]+([^.,"\{\}\[\]]+)/i);
if (locationMatch && locationMatch[1]) {
location = locationMatch[1].trim();
}

// Try to extract pattern
const patternMatch = text.match(/pattern[:\s]+"([^"]+)"/i) || 
                 text.match(/pattern[:\s]+'([^']+)'/i) ||
                 text.match(/pattern[:\s]+([^.,"\{\}\[\]]+)/i);
if (patternMatch && patternMatch[1]) {
pattern = patternMatch[1].trim();
}

// Try to extract movement impact
const movementMatch = text.match(/movement[:\s]+"([^"]+)"/i) || 
                  text.match(/movement[:\s]+'([^']+)'/i) ||
                  text.match(/movement[:\s]+([^.,"\{\}\[\]]+)/i) ||
                  text.match(/movementImpact[:\s]+"([^"]+)"/i) || 
                  text.match(/movementImpact[:\s]+'([^']+)'/i) ||
                  text.match(/movementImpact[:\s]+([^.,"\{\}\[\]]+)/i);
if (movementMatch && movementMatch[1]) {
movementImpact = movementMatch[1].trim();
}

// Add the symptom
const newSymptom = {
symptom: symptomText,
severity,
duration,
pattern,
location,
movementImpact
};

consultationData.symptoms.push(newSymptom);

// Update assessment status if needed
if (consultationData.assessmentStatus === "Not started") {
consultationData.assessmentStatus = "In Progress";
}

console.log("Added symptom from text extraction:", newSymptom);
}
}
}
} catch (error) {
console.error("Error extracting symptoms from text:", error);
}
};

// Function to prepend information to the transcript
const prependToTranscript = (text) => {
if (!uvSession) return;

try {
// Add a message to the session with the slot information
// This is a workaround to force the AI to see the slot information
uvSession.addMessage({
id: `slots-info-${Date.now()}`,
role: "tool",
content: `IMPORTANT SLOT INFORMATION: ${text}`,
created_at: new Date().toISOString()
});

console.log("Added slot information to session:", text);
} catch (error) {
console.error("Error prepending to transcript:", error);
}
};

// Function to format available slots into a clear message
const formatAvailableSlotsMessage = (slotData) => {
try {
if (!slotData || !slotData.hourly_slots || !slotData.search_criteria) {
console.warn("Missing slot data or search criteria");
return null;
}

// Extract day and date information
const dateStr = slotData.search_criteria.date;
const date = new Date(dateStr);
const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
const formattedDate = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// Extract location if available
const location = slotData.search_criteria.campus ? ` at ${slotData.search_criteria.campus}` : '';

// Create header for the message
const header = `Here are the available slots for ${day}, ${formattedDate}${location}:`;

// Build the list of available slots
const availableSlots = [];
for (const [slotKey, availability] of Object.entries(slotData.hourly_slots)) {
if (availability === "available") {
// Extract time from key format "slot_available_9-10"
const timeMatch = slotKey.match(/slot_available_(\d+)-(\d+)/);
if (timeMatch && timeMatch.length === 3) {
const startHour = parseInt(timeMatch[1]);
const endHour = parseInt(timeMatch[2]);

// Format time with AM/PM
const startTimeFormatted = startHour < 12 
? `${startHour}:00 AM` 
: `${startHour === 12 ? 12 : startHour - 12}:00 PM`;

const endTimeFormatted = endHour < 12 
? `${endHour}:00 AM` 
: `${endHour === 12 ? 12 : endHour - 12}:00 PM`;

availableSlots.push(`- ${startTimeFormatted} to ${endTimeFormatted}`);
}
}
}

// Combine header and slots
if (availableSlots.length === 0) {
return `${header}\nNo slots available for this day.`;
}

return `${header}\n${availableSlots.join('\n')}\n\nWhich time slot would you prefer?`;
} catch (error) {
console.error("Error formatting available slots message:", error);
return null;
}
};

// Process and store slot data from fetchSlots response
const processSlotData = (slotData) => {
try {
if (!slotData || !slotData.hourly_slots) {
console.warn("No hourly slots in fetchSlots response");
return;
}

// Extract available slots
const availableSlots = [];
for (const [slotKey, availability] of Object.entries(slotData.hourly_slots)) {
if (availability === "available") {
// Extract time from key format "slot_available_9-10"
const timeMatch = slotKey.match(/slot_available_(\d+)-(\d+)/);
if (timeMatch && timeMatch.length === 3) {
const startHour = parseInt(timeMatch[1]);
const endHour = parseInt(timeMatch[2]);

// Format time with AM/PM
const startTimeFormatted = startHour < 12 
? `${startHour}:00 AM` 
: `${startHour === 12 ? 12 : startHour - 12}:00 PM`;

const endTimeFormatted = endHour < 12 
? `${endHour}:00 AM` 
: `${endHour === 12 ? 12 : endHour - 12}:00 PM`;

availableSlots.push(`${startTimeFormatted} to ${endTimeFormatted}`);
}
}
}

// Store slot data in consultation data
consultationData.appointment.availableSlots = availableSlots;

// Store other search criteria info
if (slotData.search_criteria) {
consultationData.appointment.date = slotData.search_criteria.date;
consultationData.appointment.consultationType = slotData.search_criteria.consultation_type;
consultationData.appointment.campus = slotData.search_criteria.campus;
}

console.log("Processed slot data:", {
availableSlots,
date: consultationData.appointment.date,
consultationType: consultationData.appointment.consultationType,
campus: consultationData.appointment.campus
});
} catch (error) {
console.error("Error processing slot data:", error);
}
};

// Update the processSymptomData function for better error handling
const processSymptomData = (symptoms) => {
try {
if (!symptoms || !Array.isArray(symptoms)) {
console.warn("Invalid symptoms data format");
return;
}

console.log("Processing symptoms data:", symptoms);

// Process each symptom with safer handling
const processedSymptoms = symptoms.map(symptom => {
try {
// Handle string symptoms
if (typeof symptom === 'string') {
return {
symptom: symptom,
severity: 'Not specified',
duration: 'Not specified',
pattern: 'Not specified',
location: 'Not specified',
movementImpact: 'Not specified'
};
}

// Handle object symptoms
if (typeof symptom === 'object' && symptom !== null) {
// If symptom has a symptom property, use it
const symptomText = symptom.symptom || 
                symptom.name || 
                symptom.description || 
                'Unknown symptom';

return {
symptom: symptomText,
severity: symptom.severity || 'Not specified',
duration: symptom.duration || 'Not specified',
pattern: symptom.pattern || 'Not specified',
location: symptom.location || 'Not specified',
movementImpact: symptom.movementImpact || 'Not specified'
};
}

return null;
} catch (itemError) {
console.error("Error processing individual symptom:", itemError);
return null;
}
}).filter(symptom => symptom !== null);

// Check for duplicates with safer handling
const existingSymptomNames = new Set(
consultationData.symptoms.map(s => (s.symptom || '').toLowerCase())
);

// Add only non-duplicate symptoms
const newSymptoms = processedSymptoms.filter(s => 
!(s.symptom || '').toLowerCase() || // Skip empty symptom names
!existingSymptomNames.has((s.symptom || '').toLowerCase())
);

// Add to consultation data
if (newSymptoms.length > 0) {
consultationData.symptoms = [...consultationData.symptoms, ...newSymptoms];

// Update assessment status if needed
if (consultationData.assessmentStatus === "Not started") {
consultationData.assessmentStatus = "In Progress";
}

console.log("Added new symptoms:", newSymptoms);
console.log("Updated symptoms list:", consultationData.symptoms);
}
} catch (error) {
console.error("Error processing symptom data:", error);
}
};

// Helper function to extract slot information from transcripts
const updateConsultationDataFromTranscript = (text) => {
try {
// Enhanced symptom detection from transcript
const symptomPatterns = [
/I('ve| have) been (experiencing|having|feeling) (.*?)(?=\.|$)/i,
/symptoms? (of|like|such as) (.*?)(?=\.|$)/i,
/I('m| am) (experiencing|having|feeling) (.*?)(?=\.|$)/i,
/I suffer from (.*?)(?=\.|$)/i,
/troubled by (.*?)(?=\.|$)/i,
/My (.*?) (hurts|is hurting|aches|is aching|is painful)(?=\.|$)/i,
/pain in (?:my|the) (.*?)(?=\.|$)/i,
/discomfort in (?:my|the) (.*?)(?=\.|$)/i
];

for (const pattern of symptomPatterns) {
const match = text.match(pattern);
if (match && match.length > 2) {
let symptomText = match[match.length - 1].trim();

// Skip if this is a negation or question
if (symptomText.toLowerCase().includes("don't have") || 
symptomText.toLowerCase().includes("do not have") ||
text.includes("?")) {
continue;
}

// Skip common phrases that aren't symptoms
const skipPhrases = ["a question", "an appointment", "a consultation", "a booking"];
if (skipPhrases.some(phrase => symptomText.toLowerCase().includes(phrase))) {
continue;
}

console.log("Potential symptom detected:", symptomText);

// Check if we already have this symptom
const existingSymptomNames = consultationData.symptoms.map(s => s.symptom.toLowerCase());
if (!existingSymptomNames.includes(symptomText.toLowerCase())) {
// Try to extract duration information
let duration = "Not specified";
const durationMatch = text.match(/for (the past |about |approximately |around )?((\d+) (days?|weeks?|months?|years?))/i);
if (durationMatch) {
duration = durationMatch[0];
}

// Try to extract severity information
let severity = "Not specified";
const severityMatch = text.match(/(mild|moderate|severe|extreme|unbearable|slight) (pain|discomfort|ache)/i);
if (severityMatch) {
severity = severityMatch[0];
} else {
const painScaleMatch = text.match(/pain( is|'s)? (\d+)( out of | on a scale of )10/i);
if (painScaleMatch && painScaleMatch[2]) {
  severity = `${painScaleMatch[2]}/10`;
}
}

// Try to extract location information
let location = "Not specified";
const locationMatch = text.match(/pain (in|on) (my |the )?(.*?)(?=\.|,|and|but|$)/i);
if (locationMatch && locationMatch[3]) {
location = locationMatch[3].trim();
}

// Try to extract pattern information
let pattern = "Not specified";
const patternMatch = text.match(/(constant|intermittent|comes and goes|continuous|periodic|occasional) (pain|ache|discomfort)/i);
if (patternMatch) {
pattern = patternMatch[0];
}

// Try to extract movement impact
let movementImpact = "Not specified";
const movementMatch = text.match(/(worse|better|improves|worsens|increases|decreases) (when|with) (.*?)(?=\.|,|and|but|$)/i);
if (movementMatch) {
movementImpact = movementMatch[0];
}

// Add the new symptom
consultationData.symptoms.push({
symptom: symptomText,
severity: severity,
duration: duration,
pattern: pattern,
location: location,
movementImpact: movementImpact
});

// Set assessment status to in-progress if it was not started
if (consultationData.assessmentStatus === "Not started") {
consultationData.assessmentStatus = "In Progress";
}

console.log("Added new symptom from transcript:", symptomText);
}
}
}

// Look for available slots mentioned in the transcript
const availableSlotsMatch = text.match(/available slots for(.*?)(?=\.|$)/is);
if (availableSlotsMatch && availableSlotsMatch[1]) {
const slotsText = availableSlotsMatch[1].trim();
console.log("Found slots mentioned in transcript:", slotsText);

// Extract time slots using regex
const timeSlotMatches = slotsText.match(/\d+:\d+\s*(AM|PM)\s*to\s*\d+:\d+\s*(AM|PM)/gi);
if (timeSlotMatches && timeSlotMatches.length > 0) {
console.log("Extracted time slots:", timeSlotMatches);

// Update consultation data with these slots
consultationData.appointment.availableSlots = timeSlotMatches;
}
}

// Extract other appointment details like consultation type, day, etc.
// Consultation type
if (text.toLowerCase().includes("online consultation")) {
consultationData.appointment.type = "Online";
consultationData.appointment.consultationType = "Online";
} else if (text.toLowerCase().includes("in-person consultation")) {
consultationData.appointment.type = "In-person";
consultationData.appointment.consultationType = "In-person";
}

// Check for city and center
if (text.includes("Bangalore")) {
consultationData.appointment.city = "Bangalore";
} else if (text.includes("Hyderabad")) {
consultationData.appointment.city = "Hyderabad";
}

// Check for center names
if (text.includes("Indiranagar")) {
consultationData.appointment.center = "Indiranagar";
consultationData.appointment.campusId = "Indiranagar";
} else if (text.includes("Whitefield")) {
consultationData.appointment.center = "Whitefield";
consultationData.appointment.campusId = "Whitefield";
} else if (text.includes("Banjara Hills")) {
consultationData.appointment.center = "Banjara Hills";
consultationData.appointment.campusId = "Banjara Hills";
} else if (text.includes("Madhapur")) {
consultationData.appointment.center = "Madhapur";
consultationData.appointment.campusId = "Madhapur";
}

// Look for week selection
if (text.includes("this week")) {
consultationData.appointment.weekSelection = "this week";
} else if (text.includes("next week")) {
consultationData.appointment.weekSelection = "next week";
}

// Look for day selection
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayAbbrev = ["mon", "tue", "wed", "thu", "fri", "sat"];

for (let i = 0; i < days.length; i++) {
if (text.includes(days[i])) {
consultationData.appointment.day = days[i];
consultationData.appointment.selectedDay = dayAbbrev[i];
break;
}
}

// Look for time slot selection
const selectedTimeMatch = text.match(/prefer the (\d+:\d+\s*(AM|PM)\s*to\s*\d+:\d+\s*(AM|PM))/i) || 
                  text.match(/prefer (\d+:\d+\s*(AM|PM)\s*to\s*\d+:\d+\s*(AM|PM))/i) ||
                  text.match(/like the (\d+:\d+\s*(AM|PM)\s*to\s*\d+:\d+\s*(AM|PM))/i);
if (selectedTimeMatch && selectedTimeMatch[1]) {
consultationData.appointment.selectedTime = selectedTimeMatch[1];
// Extract start time (e.g., "9:00 AM")
const startTimeMatch = selectedTimeMatch[1].match(/(\d+:\d+\s*(AM|PM))/i);
if (startTimeMatch && startTimeMatch[1]) {
consultationData.appointment.startTime = startTimeMatch[1];
}
}

// Look for patient name
const nameMatch = text.match(/My name is ([^.,]+)/i) || text.match(/name is ([^.,]+)/i);
if (nameMatch && nameMatch[1]) {
consultationData.appointment.patientName = nameMatch[1].trim();
}

// Look for mobile number
const mobileMatch = text.match(/(\d{10})/);
if (mobileMatch && mobileMatch[1]) {
consultationData.appointment.mobileNumber = mobileMatch[1];
}

// Look for booking confirmation details
if (text.includes("appointment is confirmed") || text.includes("appointment has been booked")) {
consultationData.appointment.status = "Confirmed";

// Try to extract appointment ID if present
const idMatch = text.match(/booking ID[:\s]+([A-Za-z0-9-]+)/i) || 
          text.match(/appointment ID[:\s]+([A-Za-z0-9-]+)/i) ||
          text.match(/reference[:\s]+([A-Za-z0-9-]+)/i);
if (idMatch && idMatch[1]) {
consultationData.appointment.id = idMatch[1];
}

// Try to extract doctor name if present
const doctorMatch = text.match(/with Dr\.\s+([^.,]+)/i) || 
             text.match(/with ([^.,]+)\s+on/i);
if (doctorMatch && doctorMatch[1]) {
consultationData.appointment.doctor = doctorMatch[1].trim();
}

// Look for payment link
const linkMatch = text.match(/payment link[:\s]+(https?:\/\/[^\s]+)/i) || 
           text.match(/(https?:\/\/rzp\.io\/[^\s]+)/i);
if (linkMatch && linkMatch[1]) {
consultationData.appointment.paymentLink = linkMatch[1].trim();
}
}

console.log("Updated consultation data from transcript:", JSON.stringify(consultationData, null, 2));
} catch (error) {
console.error("Error extracting data from transcript:", error);
}
};

// Get recorded consultation data for UI display
export const getConsultationData = () => {
return consultationData;
};

// Cleanup function
export const cleanupSession = () => {
try {
console.log("Cleaning up session");

if (uvSession) {
uvSession.leaveCall();
uvSession = null;
}

// Reset consultation data
consultationData = {
symptoms: [],
appointment: {},
assessmentStatus: "Not started"
};

console.log("Session cleaned up successfully");
} catch (error) {
console.error("Error in cleanupSession:", error);
}
};

// Implementation functions for the client tools
const changeStageImpl = async (params) => {
try {
const newStage = params.newStage;
console.log(`changeStage called with stage: ${newStage}`);

// Get the system prompt for the new stage
const systemPrompt = getSystemPrompt(currentUserEmail, currentAppointments, newStage);

// Return the new stage info
return {
type: "new-stage",
systemPrompt,
voice: "Jessica",
temperature: 0.3,
languageHint: "en"
};
} catch (error) {
console.error("Error in changeStage:", error);
throw error;
}
};

// Update the updateConsultationImpl function for better JSON safety
const updateConsultationImpl = async (params) => {
try {
console.log("updateConsultation called with:", JSON.stringify(params, null, 2));

if (params && params.consultationData) {
// Handle symptoms
if (params.consultationData.symptoms) {
try {
// Ensure we have an array of symptoms
const symptomsToAdd = Array.isArray(params.consultationData.symptoms) 
? params.consultationData.symptoms 
: [params.consultationData.symptoms];

// Process each symptom and ensure it has required fields
const processedSymptoms = symptomsToAdd.map(s => {
try {
  if (typeof s === 'string') {
    // Handle case where only the symptom name is provided
    return {
      symptom: s,
      severity: 'Not specified',
      duration: 'Not specified',
      pattern: 'Not specified',
      location: 'Not specified',
      movementImpact: 'Not specified'
    };
  } else if (typeof s === 'object' && s !== null) {
    // Ensure all required fields exist
    return {
      symptom: s.symptom || 'Unknown symptom',
      severity: s.severity || 'Not specified',
      duration: s.duration || 'Not specified',
      pattern: s.pattern || 'Not specified',
      location: s.location || 'Not specified',
      movementImpact: s.movementImpact || 'Not specified'
    };
  }
  return null;
} catch (itemError) {
  console.error("Error processing individual symptom item:", itemError);
  return null;
}
}).filter(s => s !== null);

// Check for duplicates by symptom name
const existingSymptomNames = new Set(
consultationData.symptoms.map(s => (s.symptom || '').toLowerCase())
          );
          
          // Filter out duplicates
          const newSymptoms = processedSymptoms.filter(s => 
            !(s.symptom || '').toLowerCase() || // Skip empty symptom names
            !existingSymptomNames.has((s.symptom || '').toLowerCase())
          );
          
          // Add new symptoms to the list
          if (newSymptoms.length > 0) {
            consultationData.symptoms = [...consultationData.symptoms, ...newSymptoms];
            
            // Update assessment status if symptoms are being added
            if (consultationData.assessmentStatus === "Not started") {
              consultationData.assessmentStatus = "In Progress";
            }
            
            console.log("Updated symptoms list:", JSON.stringify(consultationData.symptoms, null, 2));
          }
        } catch (symptomsError) {
          console.error("Error processing symptoms:", symptomsError);
        }
      }
      
      // Handle assessment status
      if (params.consultationData.assessmentStatus) {
        consultationData.assessmentStatus = params.consultationData.assessmentStatus;
      }
      
      // Handle appointment data
      if (params.consultationData.appointment) {
        try {
          // Specifically check for and preserve mobile number
          if (params.consultationData.appointment.mobileNumber) {
            // Store the mobile number separately to ensure it's preserved
            const mobileNumber = params.consultationData.appointment.mobileNumber;
            
            // Update the rest of the appointment data
            consultationData.appointment = {
              ...consultationData.appointment,
              ...params.consultationData.appointment,
              // Ensure mobile number is preserved with the explicitly provided value
              mobileNumber: mobileNumber
            };
            
            console.log("Updated appointment with mobile number:", mobileNumber);
          } else {
            // Regular update without specific mobile number
            consultationData.appointment = {
              ...consultationData.appointment,
              ...params.consultationData.appointment
            };
          }
        } catch (appointmentError) {
          console.error("Error updating appointment data:", appointmentError);
        }
      }
    }
    
    console.log("Updated consultation data:", JSON.stringify(consultationData, null, 2));
    
    // Return a success message with the current symptom count
    return `Consultation data updated successfully. Current symptom count: ${consultationData.symptoms.length}`;
  } catch (error) {
    console.error("Error in updateConsultation:", error);
    // Still return a success message to avoid stopping the conversation flow
    return "Consultation data processed.";
  }
};

export const demoConfig = async (userEmail) => {
  try {
    console.log("Generating demo config for user:", userEmail);
    
    // Fetch existing appointments
    const appointments = await fetchAppointments(userEmail);
    
    // Store the current user and appointments for stage changes
    currentUserEmail = userEmail;
    currentAppointments = appointments;
    
    // Define tools - Using existing durable tools for fetchSlots and bookAppointment
    const selectedTools = [
      {
        temporaryTool: {
          modelToolName: "changeStage",
          description: "Change the conversation stage to a new context",
          dynamicParameters: [
            {
              name: "newStage",
              location: ParameterLocation.BODY,
              schema: {
                type: "string", 
                enum: ["initial", "symptom", "booking", "appointmentLookup"],
                description: "The name of the new stage to transition to"
              },
              required: true
            }
          ],
          client: {
            implementation: changeStageImpl
          }
        }
      },
      {
        temporaryTool: {
          modelToolName: "updateConsultation",
          description: "Update consultation details including symptoms and appointment information",
          dynamicParameters: [
            {
              name: "consultationData",
              location: ParameterLocation.BODY,
              schema: {
                type: "object",
                properties: {
                  symptoms: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        symptom: { type: "string" },
                        severity: { type: "string" },
                        duration: { type: "string" },
                        pattern: { type: "string" },
                        location: { type: "string" },
                        movementImpact: { type: "string" }
                      }
                    }
                  },
                  appointment: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      location: { type: "string" },
                      date: { type: "string" },
                      time: { type: "string" },
                      mobileNumber: { type: "string" }
                    }
                  },
                  assessmentStatus: { type: "string" }
                }
              },
              required: true
            }
          ],
          client: {
            implementation: updateConsultationImpl
          }
        }
      },
      // Using existing durable tool for fetchSlots by ID
      {
        toolId: "b12be5dc-46c7-41bc-be10-ef2eee906df8" // Using the correct ID from example
      },
      // Using existing durable tool for bookAppointment by ID
      {
        toolId: "9b4aac67-37d0-4f1d-888f-ead39702d206"
      }
    ];
    
    // Return the complete config
    return {
      title: "Physiotattva Virtual Consultation",
      overview: "Multi-agent system for physiotherapy consultations",
      callConfig: {
        systemPrompt: getSystemPrompt(userEmail, appointments, "initial"),
        model: "fixie-ai/ultravox-70B",
        languageHint: "en",
        voice: "Monika-English-Indian",
        temperature: 0.3,
        selectedTools: selectedTools
      }
    };
  } catch (error) {
    console.error("Error in demoConfig:", error);
    throw error;
  }
};

export default demoConfig;
