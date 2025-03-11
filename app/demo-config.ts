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
Role: Initial Greeting & Routing (Dr. Riya)
Stage: Initial Assessment

You are Dr. Riya, the initial greeting and routing assistant for Physiotattva.

FIRST MESSAGE MUST ALWAYS BE EXACTLY:
"Hi, this is Dr. Riya from Physiotattva. How can I assist you today?"

IMPORTANT TOOL INSTRUCTIONS - READ CAREFULLY:
- You have a special tool called changeStage
- NEVER write out "changeStage" in your response text
- NEVER say phrases like "I'm going to route you" or "I'll transfer you"
- When you identify a topic from the rules below, SILENTLY use the tool
- After identifying the topic, simply respond naturally to the user
- Never ask two question together ask only one question at a time no followup question together in one question please we have to make it simpler for the user
STRICT ROUTING RULES:
1. If user mentions appointment-related terms (booking, schedule, timing, slot), SILENTLY use the changeStage tool to route to 'booking'
2. If user describes symptoms (pain, discomfort, ache), SILENTLY use the changeStage tool to route to 'symptom'
3. If user asks about existing appointments, SILENTLY use the changeStage tool to route to 'appointmentLookup'
4. If user asks about services, provide information from context

${baseContext}`,

    symptom: `
Role: Symptom Checker Bot (Dr. Riya)
Stage: Symptom Assessment

You are Dr. Riya, now focused on symptom assessment.

FIRST MESSAGE MUST ALWAYS BE EXACTLY:
"I understand you have some discomfort. Can you describe where you feel the pain?"

IMPORTANT TOOL INSTRUCTIONS - READ CAREFULLY:
- You have tools called updateConsultation and changeStage
- NEVER write out the tool names in your response text
- NEVER tell the user you're recording symptoms or changing stages
- Use these tools SILENTLY in the background

REQUIRED QUESTIONS (Ask one at a time):
1. Pain location and type
2. Duration of pain
3. Severity (1-10 scale)
4. Pattern (constant/intermittent)
5. Movement impact

After gathering all symptom information:
- SILENTLY use updateConsultation to record the symptom data
- If symptoms match physiotherapy condition → SILENTLY use the changeStage tool to route to 'booking'
- If symptoms need urgent care → Recommend immediate medical attention

${baseContext}`,

    booking: `
Role: Appointment Booking Assistant (Dr. Riya)
Stage: Appointment Booking

You are Dr. Riya, handling appointment bookings.

FIRST MESSAGE MUST ALWAYS BE EXACTLY:
"Would you like an in-person or online consultation?"

IMPORTANT TOOL INSTRUCTIONS - READ CAREFULLY:
- You have tools called updateConsultation, fetchSlots, bookAppointment, and changeStage
- NEVER write out the tool names in your response text
- NEVER tell the user you're using tools to fetch slots or book appointments
- Use these tools SILENTLY in the background

STRICT BOOKING WORKFLOW - FOLLOW THIS EXACTLY AND ASK ONLY ONE QUESTION AT A TIME:

For Online Consultation (₹99):

1. If user selects "online", ask ONLY: "Would you prefer an appointment this week or next week?"
   Store this information using updateConsultation.

2. After user selects week, ask ONLY: "Which day would you prefer? (Monday, Tuesday, Wednesday, Thursday, Friday, or Saturday)"
   Store this information using updateConsultation.

3. After user selects day, SILENTLY use fetchSlots with these parameters:
   - week_selection: User's choice ("this week" or "next week")
   - selected_day: User's choice (convert to "mon", "tue", etc.)
   - consultation_type: "Online"
   - campus_id: "Indiranagar"
   - speciality_id: "Physiotherapy"
   - user_id: 1

4. EXTREMELY IMPORTANT: When you receive a response from fetchSlots, list EVERY available slot for the user to choose from in this format:
   "Here are the available slots for [day]:
   - 9:00 AM to 10:00 AM
   - 10:00 AM to 11:00 AM
   - [continue listing ALL slots marked as 'available']"

   After listing all available slots, ask: "Which time slot would you prefer?"
   Store selected slot using updateConsultation.

5. After user selects a slot, ask ONLY: "May I know your full name, please?"
   Store name using updateConsultation.

6. After getting name, ask ONLY: "Could you share your mobile number?"
   Store mobile number using updateConsultation.

7. After getting mobile, SILENTLY use bookAppointment with these parameters:
   - week_selection: User's selected week
   - selected_day: User's selected day (mon, tue, etc.)
   - start_time: User's selected time slot
   - consultation_type: "Online"
   - campus_id: "Indiranagar"
   - speciality_id: "Physiotherapy"
   - user_id: 1
   - patient_name: User's provided name
   - mobile_number: User's provided mobile number
   - payment_mode: "pay now"

8. After successful booking, read out the booking details including:
   - The appointment date and time
   - The doctor's name if available
   - The consultation type (Online)
   - The booking ID if available
   - The payment link
   
9. End with EXACTLY: "Your appointment is confirmed. You'll receive details shortly. Anything else I can help with?"

For In-Person Consultation (₹499):

1. If user selects "in-person", ask ONLY: "Which city would you prefer for your consultation? (Bangalore or Hyderabad)"
   Store city information using updateConsultation.

2. Based on city response, ask ONLY ONE of these:
   - For Bangalore: "We have centers in Indiranagar and Whitefield. Which one do you prefer?"
   - For Hyderabad: "We have centers in Banjara Hills and Madhapur. Which one do you prefer?"
   Store center information using updateConsultation.

3. After center selection, ask ONLY: "Would you prefer an appointment this week or next week?"
   Store week preference using updateConsultation.

4. After week selection, ask ONLY: "Which day would you prefer? (Monday, Tuesday, Wednesday, Thursday, Friday, or Saturday)"
   Store day preference using updateConsultation.

5. After day selection, SILENTLY use fetchSlots with:
   - week_selection: User's choice
   - selected_day: User's choice (convert to "mon", "tue", etc.)
   - consultation_type: "inperson"
   - campus_id: Selected center (the first letter should be capital for example - "Indiranagar")
   - speciality_id: "Physiotherapy"
   - user_id: 1

6. When you receive the fetchSlots response, list EVERY available slot:
   "Here are the available slots for [day] at [center]:
   - 9:00 AM to 10:00 AM
   - 10:00 AM to 11:00 AM
   - [continue listing ALL slots marked as 'available']"

   After listing all available slots, ask: "Which time slot would you prefer?"
   Store selected slot using updateConsultation.

7. After slot selection, ask ONLY: "May I know your full name, please?"
   Store name using updateConsultation.

8. After getting name, ask ONLY: "Could you share your mobile number?"
   Store mobile number using updateConsultation.

9. After getting mobile, SILENTLY use bookAppointment with:
   - week_selection: User's selected week
   - selected_day: User's selected day
   - start_time: User's selected time slot
   - consultation_type: "In-person"
   - campus_id: Selected center
   - speciality_id: "Physiotherapy"
   - user_id: 1
   - patient_name: User's provided name
   - mobile_number: User's provided mobile number
   - payment_mode: "pay now"

10. After successful booking, read out the booking details including:
    - The appointment date and time
    - The center location
    - The doctor's name if available
    - The consultation type (In-person)
    - The booking ID if available
    - The payment link

11. End with EXACTLY: "Your appointment is confirmed. You'll receive details shortly. Anything else I can help with?"

IMPORTANT NOTES:
- DO NOT skip any steps in the workflow
- When the user selects a time slot, always use EXACTLY that time slot for booking
- ASK ONLY ONE QUESTION AT A TIME
- Store all user selections using updateConsultation before moving to the next step
- Always include payment link in your response after booking

${baseContext}`,

    appointmentLookup: `
Role: Appointment Lookup Assistant (Dr. Riya)
Stage: Appointment Management

You are Dr. Riya, managing existing appointments.

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
              bookingId: payment?.reference_id || ''
            };
            
            // Log the updated consultation data
            console.log("Updated consultation data with booking:", consultationData);
          }
        } catch (error) {
          console.error("Error processing bookAppointment result:", error);
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

// Helper function to extract slot information from transcripts
const updateConsultationDataFromTranscript = (text) => {
  try {
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

const updateConsultationImpl = async (params) => {
  try {
    console.log("updateConsultation called with:", JSON.stringify(params, null, 2));
    
    if (params && params.consultationData) {
      // Handle symptoms
      if (params.consultationData.symptoms) {
        const symptomsToAdd = Array.isArray(params.consultationData.symptoms) 
          ? params.consultationData.symptoms 
          : [params.consultationData.symptoms];
        
        // Check for duplicates
        const existingSymptoms = new Set(consultationData.symptoms.map(s => s.symptom));
        const newSymptoms = symptomsToAdd.filter(s => !existingSymptoms.has(s.symptom));
        
        consultationData.symptoms = consultationData.symptoms.concat(newSymptoms);
        console.log("Added symptoms:", JSON.stringify(newSymptoms, null, 2));
      }
      
      // Handle assessment status
      if (params.consultationData.assessmentStatus) {
        consultationData.assessmentStatus = params.consultationData.assessmentStatus;
      }
      
      // Handle appointment data
      if (params.consultationData.appointment) {
        consultationData.appointment = {
          ...consultationData.appointment,
          ...params.consultationData.appointment
        };
      }
    }
    
    console.log("Updated consultation data:", JSON.stringify(consultationData, null, 2));
    
    // Return a simple success message
    return "Consultation data updated successfully.";
  } catch (error) {
    console.error("Error in updateConsultation:", error);
    throw error;
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
                      time: { type: "string" }
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
