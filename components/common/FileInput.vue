<script setup lang="ts">
const props = defineProps<{
  accept?: string
  multiple?: boolean
  label?: string
  buttonText?: string
}>()

const emit = defineEmits<{
  'file-selected': [files: File[]]
}>()

const fileInput = ref<HTMLInputElement>()

function openFileDialog() {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) {
    return
  }
  
  // Convert FileList to array
  const files = Array.from(input.files)
  emit('file-selected', files)
  
  // Reset the input so the same file can be selected again
  input.value = ''
}
</script>

<template>
  <div class="file-input-container">
    <label v-if="label" class="file-input-label">{{ label }}</label>
    <button 
      class="file-input-button"
      @click="openFileDialog"
      type="button"
    >
      <slot>{{ buttonText || 'Select File' }}</slot>
    </button>
    <input 
      type="file" 
      ref="fileInput" 
      @change="handleFileChange" 
      :accept="accept" 
      :multiple="multiple"
      class="hidden-file-input"
    />
  </div>
</template>

<style scoped>
.file-input-container {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
}

.file-input-label {
  margin-bottom: 4px;
  font-size: 14px;
}

.file-input-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  background-color: #4b5563;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.file-input-button:hover {
  background-color: #6b7280;
}

.hidden-file-input {
  display: none;
}
</style> 