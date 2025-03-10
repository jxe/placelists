import { redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/new";
import { createPlacelist } from "../../lib/db";
import { parsePlacelistText } from "../../lib/utils";
import PlacelistEditor from "../../components/PlacelistEditor";

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

  return (
    <PlacelistEditor
      formAction=""
      defaultValues={{
        name: actionData?.values?.name || "",
        description: actionData?.values?.description || "",
        placelistText: actionData?.values?.placelistText || ""
      }}
      errors={actionData?.errors}
      isSubmitting={isSubmitting}
      isEditing={false}
    />
  );
}