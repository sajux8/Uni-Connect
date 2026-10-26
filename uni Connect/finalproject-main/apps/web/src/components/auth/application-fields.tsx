"use client";

import { useState } from "react";

import { describedBy, Field, SelectInput, TextArea, TextInput } from "@/components/forms/field";
import { parseStudentId, STUDENT_ID_EXAMPLE } from "@/lib/student-id";

export interface DepartmentOption {
  id: string;
  name: string;
}

/**
 * Department, ID and note: the part of the application a coordinator checks.
 * Shared by /register and the "Edit details" form on /pending.
 */
export function ApplicationFields({
  departments,
  role,
  values,
  errors,
}: {
  departments: DepartmentOption[];
  role: "student" | "staff";
  values?: Record<string, string>;
  errors?: Record<string, string[] | undefined>;
}) {
  const err = (key: string) => errors?.[key]?.[0];
  const [idNumber, setIdNumber] = useState(values?.idNumber ?? "");
  const intake = role === "student" ? parseStudentId(idNumber)?.intake : undefined;

  return (
    <>
      <div className="grid gap-4">
        <Field id="departmentId" label="Department" error={err("departmentId")}>
          <SelectInput
            id="departmentId"
            name="departmentId"
            required
            defaultValue={values?.departmentId ?? ""}
            {...describedBy("departmentId", err("departmentId"))}
          >
            <option value="" disabled>
              Choose…
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <Field
        id="idNumber"
        label={role === "staff" ? "Staff ID" : "Student ID"}
        hint={
          role === "staff"
            ? "Only your coordinator and the super admins see this."
            : intake
              ? `You'll be placed in Batch ${intake} of your department once approved.`
              : `Like ${STUDENT_ID_EXAMPLE}. Only your coordinator and the super admins see it.`
        }
        error={err("idNumber")}
      >
        <TextInput
          id="idNumber"
          name="idNumber"
          required
          maxLength={40}
          autoComplete="off"
          placeholder={role === "student" ? STUDENT_ID_EXAMPLE : undefined}
          defaultValue={values?.idNumber}
          onChange={(event) => setIdNumber(event.target.value)}
          className={role === "student" ? "uppercase placeholder:normal-case" : undefined}
          {...describedBy("idNumber", err("idNumber"), true)}
        />
      </Field>

      <Field
        id="note"
        label="Anything your coordinator should know?"
        optional
        hint="For example, your programme or society role. Up to 300 characters."
        error={err("note")}
      >
        <TextArea
          id="note"
          name="note"
          rows={3}
          maxLength={300}
          defaultValue={values?.note}
          {...describedBy("note", err("note"), true)}
        />
      </Field>
    </>
  );
}
