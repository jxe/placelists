import { redirect, useActionData, useNavigation, Form } from "react-router";
import { useRef, useState } from "react";
import type { Route } from "./+types/new";
import { createPlacelist } from "../../lib/db";
import { parsePlacelistText } from "../../lib/utils";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const placelistText = formData.get("placelistText") as string;

  const errors: Record<string, string> = {};
  
  if (!name || name.trim() === "") {
    errors.name = "Name is required";
  }

  if (!placelistText || placelistText.trim() === "") {
    errors.placelistText = "Placelist content is required";
  }

  if (Object.keys(errors).length > 0) {
    return { 
      errors, 
      values: { name, description, placelistText },
      status: 400 
    };
  }

  try {
    const items = parsePlacelistText(placelistText);
    
    if (items.length === 0) {
      return { 
        errors: { placelistText: "No valid items found in placelist text" },
        values: { name, description, placelistText },
        status: 400 
      };
    }

    const placelist = await createPlacelist({
      name,
      description: description || undefined,
      items,
    });

    return redirect(`/placelists/${placelist.id}`);
  } catch (error) {
    return { 
      errors: { placelistText: error instanceof Error ? error.message : "Failed to parse placelist" },
      values: { name, description, placelistText },
      status: 400 
    };
  }
}

export function meta() {
  return [
    { title: "Create New Placelist - SpotiSpot" },
    { name: "description", content: "Create a new location-based music playlist" },
  ];
}

export default function NewPlacelist() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Function to add current location to the textarea
  const addCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsGettingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locationString = `${latitude},${longitude}\n`;
        
        if (textareaRef.current) {
          const textArea = textareaRef.current;
          const currentValue = textArea.value;
          
          // If there's already text, add a new line if needed
          const newValue = currentValue 
            ? (currentValue.endsWith('\n') ? currentValue : currentValue + '\n') + locationString
            : locationString;
            
          textArea.value = newValue;
          
          // Set focus to textarea and position cursor at end
          textArea.focus();
          textArea.setSelectionRange(newValue.length, newValue.length);
        }
        
        setIsGettingLocation(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        alert(`Error getting location: ${error.message}`);
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-8">Create New Placelist</h1>

      <Form method="post" className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            defaultValue={actionData?.values?.name}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
          />
          {actionData?.errors?.name && (
            <p className="text-red-500 text-sm mt-1">{actionData.errors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-2">
            Description (Optional)
          </label>
          <textarea
            id="description"
            name="description"
            defaultValue={actionData?.values?.description}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 h-24"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="placelistText" className="block text-sm font-medium">
              Placelist Content
            </label>
            <button
              type="button"
              onClick={addCurrentLocation}
              disabled={isGettingLocation}
              className="text-sm bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded disabled:opacity-50 flex items-center"
            >
              {isGettingLocation ? (
                <span>Getting location...</span>
              ) : (
                <>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4 mr-1" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Add Current Location
                </>
              )}
            </button>
          </div>
          <div className="mb-2 text-sm text-gray-600">
            <p>Enter alternating lines of:</p>
            <ol className="list-decimal list-inside mt-1 ml-4 space-y-1">
              <li>Latitude,Longitude (e.g., "37.7749,-122.4194")</li>
              <li>Spotify link (e.g., "https://open.spotify.com/track/...")</li>
            </ol>
          </div>
          <textarea
            ref={textareaRef}
            id="placelistText"
            name="placelistText"
            defaultValue={actionData?.values?.placelistText}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 h-72 font-mono"
            placeholder="37.7749,-122.4194
https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT
37.7833,-122.4167
https://open.spotify.com/track/0GswOA5NnzbGuC7WWjmCck"
          />
          {actionData?.errors?.placelistText && (
            <p className="text-red-500 text-sm mt-1">{actionData.errors.placelistText}</p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-6 rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Placelist"}
          </button>
        </div>
      </Form>
    </div>
  );
}