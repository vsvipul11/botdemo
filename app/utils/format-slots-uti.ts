// Function to format available slots from hourly_slots object
export const formatAvailableSlots = (hourlySlots) => {
    if (!hourlySlots) return [];
    
    const availableSlots = [];
    
    for (const [slotKey, availability] of Object.entries(hourlySlots)) {
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
    
    return availableSlots;
  };
  
  // Function to get day name from date string
  export const getDayFromDate = (dateStr) => {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
  };
  
  // Convert day name to abbreviation for API calls
  export const getDayAbbreviation = (dayName) => {
    const days = {
      "Monday": "mon",
      "Tuesday": "tue",
      "Wednesday": "wed",
      "Thursday": "thu",
      "Friday": "fri",
      "Saturday": "sat",
      "Sunday": "sun"
    };
    
    return days[dayName] || '';
  };
  
  // Convert time slot to start time format for API
  export const getStartTimeFromSlot = (slot) => {
    if (!slot) return '';
    
    // Extract start time (e.g. "9:00 AM" from "9:00 AM to 10:00 AM")
    const startTimeMatch = slot.match(/(\d+:\d+\s*(AM|PM))/i);
    if (startTimeMatch && startTimeMatch[1]) {
      return startTimeMatch[1];
    }
    
    return '';
  };