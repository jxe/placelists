import { redirect, useActionData, useLoaderData, useNavigation, Form, Link } from "react-router";
import { useRef, useState } from "react";
import type { Route } from "./+types/$id.edit";
import { getPlacelist, updatePlacelist } from "../../lib/db";
import { parsePlacelistText } from "../../lib/utils";

export async function loader({ params }: Route.LoaderArgs) {
  const placelist = await getPlacelist(params.id as string);
  
  if (!placelist) {
    throw new Response("Not Found", { status: 404 });
  }
  
  // Convert the items array to text format
  const items = placelist.items as Array<{ location: { lat: number; lng: number }; spotifyUrl: string }>;
  const placelistText = items.map(item => 
    `${item.location.lat},${item.location.lng}\n${item.spotifyUrl}`
  ).join('\n');
  
  return { placelist, placelistText };
}

export async function action({ params, request }: Route.ActionArgs) {
  const placelist = await getPlacelist(params.id as string);
  
  if (!placelist) {
    throw new Response("Not Found", { status: 404 });
  }
  
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
    return { errors, values: { name, description, placelistText }, status: 400 };
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

    await updatePlacelist(placelist.id, {
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

export function meta({ data }: Route.MetaArgs) {
  if (!data?.placelist) {
    return [{ title: "Placelist Not Found - SpotiSpot" }];
  }
  
  return [
    { title: `Edit ${data.placelist.name} - SpotiSpot` },
  ];
}

export default function EditPlacelist() {
  const { placelist, placelistText } = useLoaderData<typeof loader>();
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
      <Link to={`/placelists/${placelist.id}`} className="text-green-500 hover:underline mb-8 inline-block">
        ← Back to placelist
      </Link>
      
      <h1 className="text-3xl font-bold mb-8">Edit Placelist</h1>

      <Form method="post" className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            defaultValue={actionData?.values?.name ?? placelist.name}
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
            defaultValue={actionData?.values?.description ?? placelist.description ?? ""}
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
            defaultValue={actionData?.values?.placelistText ?? placelistText}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 h-72 font-mono"
          />
          {actionData?.errors?.placelistText && (
            <p className="text-red-500 text-sm mt-1">{actionData.errors.placelistText}</p>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <Link
            to={`/placelists/${placelist.id}`}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-6 rounded-lg"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-6 rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Form>
    </div>
  );
}