import { redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import type { Route } from "./+types/$id.edit";
import { getPlacelist, updatePlacelist } from "../../lib/db";
import { parsePlacelistText } from "../../lib/utils";
import PlacelistEditor from "../../components/PlacelistEditor";
import { requireUser } from "../../lib/session";

export async function loader({ request, params }: Route.LoaderArgs) {
  // Get the logged-in user
  const user = await requireUser(request);
  
  const placelist = await getPlacelist(params.id as string);
  
  if (!placelist) {
    throw new Response("Not Found", { status: 404 });
  }
  
  // Check if the user is the author
  if (placelist.authorId !== user.id) {
    throw new Response("Unauthorized: You can only edit your own placelists", { status: 403 });
  }
  
  // Convert the items array to text format
  const items = placelist.items as Array<{ location: { lat: number; lng: number }; spotifyUrl: string }>;
  const placelistText = items.map(item => 
    `${item.location.lat},${item.location.lng}\n${item.spotifyUrl}`
  ).join('\n');
  
  return { placelist, placelistText, user };
}

export async function action({ params, request }: Route.ActionArgs) {
  // Get the logged-in user
  const user = await requireUser(request);
  
  const placelist = await getPlacelist(params.id as string);
  
  if (!placelist) {
    throw new Response("Not Found", { status: 404 });
  }
  
  // Check if the user is the author
  if (placelist.authorId !== user.id) {
    throw new Response("Unauthorized: You can only edit your own placelists", { status: 403 });
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

  return (
    <PlacelistEditor
      formAction=""
      defaultValues={{
        name: actionData?.values?.name ?? placelist.name,
        description: actionData?.values?.description ?? placelist.description ?? "",
        placelistText: actionData?.values?.placelistText ?? placelistText
      }}
      errors={actionData?.errors}
      isSubmitting={isSubmitting}
      isEditing={true}
      cancelHref={`/placelists/${placelist.id}`}
    />
  );
}