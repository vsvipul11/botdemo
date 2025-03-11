// utils/consultation-utils.ts
import { ConsultationData } from '@/lib/types';

export const parseConsultationData = (message: string): ConsultationData | null => {
  try {
    // First, try to find JSON in the message
    const jsonRegex = /\{[\s\S]*?\}/g;
    const matches = message.match(jsonRegex);
    
    if (!matches) return null;

    // Try each match until we find valid consultation data
    for (const match of matches) {
      try {
        const parsed = JSON.parse(match);
        
        // Handle different data structures
        const data = parsed.value?.consultationData || 
                    parsed.value || 
                    parsed.consultationData || 
                    parsed;

        // Validate the data structure
        if (!data || (typeof data !== 'object')) continue;

        // Ensure we have either symptoms or appointment
        if (!data.symptoms && !data.appointment) continue;

        return {
          symptoms: data.symptoms || [],
          appointment: data.appointment,
          assessmentStatus: data.assessmentStatus || 'pending'
        };
      } catch (e) {
        continue; // Try next match if this one fails
      }
    }
    return null;
  } catch (error) {
    console.error('Error parsing consultation data:', error);
    return null;
  }
};